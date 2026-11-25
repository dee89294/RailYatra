/**
 * ============================================================================
 * File: server/src/services/authService.ts
 * Purpose: Business logic for User Registration, Email Verification, Login,
 *          Password Reset, and Profile Management.
 * Responsibilities:
 *   - Connects authentication flows to either **Supabase Auth** (when configured)
 *     or **Local SQLite + JWT + scrypt** (when running locally without keys).
 *   - Ensures every newly registered user receives a profile row in `profiles`.
 *   - Enforces email verification before ticket booking and supports resending
 *     verification links via `emailService`.
 * Used by: `routes/authRoutes.ts`.
 * Dependencies: `db/repository.ts`, `db/supabaseClient.ts`, `services/emailService.ts`,
 *               `utils/crypto.ts`.
 * ============================================================================
 */

import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { getSupabaseAdmin, getSupabaseAnon } from '../db/supabaseClient.js';
import { AppError } from '../middleware/errorHandler.js';
import type { UserProfile } from '../types/index.js';
import {
  createVerificationToken,
  hashPassword,
  hashToken,
  signLocalJwt,
  verifyPassword,
} from '../utils/crypto.js';
import { createUuid } from '../utils/seedData.js';
import { emailService } from './emailService.js';

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  provider: 'supabase' | 'local';
  verificationPreviewUrl?: string;
}

export const authService = {
  /**
   * Registers a new Registered User (`role: 'user'`), creates their `profiles`
   * record, and dispatches a verification email.
   */
  async register(input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{
    message: string;
    email: string;
    requiresVerification: boolean;
    verificationPreviewUrl?: string;
  }> {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const phone = input.phone.trim();

    if (!fullName || fullName.length < 2) {
      throw new AppError('Full name must be at least 2 characters.', 400, 'VALIDATION_ERROR');
    }
    if (!email || !email.includes('@')) {
      throw new AppError('Please provide a valid email address.', 400, 'VALIDATION_ERROR');
    }
    if (!input.password || input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400, 'VALIDATION_ERROR');
    }

    if (env.provider === 'supabase') {
      const existingProfile = await repository.getProfileByEmail(email);
      if (existingProfile) {
        if (existingProfile.email_verified) {
          throw new AppError(
            'An account with this email already exists. Please log in instead.',
            409,
            'EMAIL_ALREADY_EXISTS'
          );
        }
        throw new AppError(
          'This email is already registered but not yet verified. Go to Login and click Resend Verification Email.',
          409,
          'EMAIL_ALREADY_EXISTS_UNVERIFIED'
        );
      }

      // When Nodemailer SMTP is configured (or in local development via Dev Email Outbox),
      // generate the Supabase signup confirmation token server-side and send via emailService
      // so arbitrary users can register without hitting Supabase's 2-emails/hour built-in limit.
      if (env.smtp.configured || env.nodeEnv !== 'production') {
        const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
          type: 'signup',
          email,
          password: input.password,
          options: {
            redirectTo: `${env.clientUrl}/verify-email`,
            data: {
              full_name: fullName,
              phone,
            },
          },
        });

        if (error) {
          if (/already|registered|exists/i.test(error.message)) {
            throw new AppError(
              'An account with this email already exists. Please log in instead.',
              409,
              'EMAIL_ALREADY_EXISTS'
            );
          }
          throw new AppError(error.message, 400, 'SUPABASE_SIGNUP_ERROR');
        }

        const hashedToken = data.properties?.hashed_token;
        if (!hashedToken) {
          throw new AppError(
            'Account created, but verification token could not be generated.',
            500,
            'VERIFICATION_TOKEN_ERROR'
          );
        }

        let mailResult: { deliveredVia: 'smtp' | 'dev_outbox' };
        try {
          mailResult = await emailService.sendVerificationEmail(email, fullName, hashedToken);
        } catch (mailError) {
          // Roll back auth user creation if SMTP fails so the user can retry after fixing SMTP
          if (data.user?.id) {
            await getSupabaseAdmin().auth.admin.deleteUser(data.user.id).catch(() => {});
          }
          const detail = mailError instanceof Error ? mailError.message : 'SMTP delivery failed.';
          throw new AppError(
            `Could not send verification email (${detail}). Check your SMTP_* settings.`,
            502,
            'SMTP_DELIVERY_FAILED'
          );
        }
        const preview = emailService.getDevOutbox(email)[0];

        return {
          message:
            mailResult.deliveredVia === 'smtp'
              ? 'Registration successful! Please check your email inbox to verify your account.'
              : 'Account created! Verify your email using the Dev Email Outbox link below (configure SMTP_* for live inbox delivery).',
          email,
          requiresVerification: true,
          verificationPreviewUrl:
            env.nodeEnv !== 'production' ? preview?.verificationUrl : undefined,
        };
      }

      const { data, error } = await getSupabaseAnon().auth.signUp({
        email,
        password: input.password,
        options: {
          emailRedirectTo: `${env.clientUrl}/verify-email`,
          data: {
            full_name: fullName,
            phone,
          },
        },
      });

      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message)) {
          throw new AppError(
            'Email delivery rate limit reached on Supabase default mailer (2/hour). Configure SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables so unlimited users can register.',
            429,
            'EMAIL_RATE_LIMIT'
          );
        }
        throw new AppError(error.message, 400, 'SUPABASE_SIGNUP_ERROR');
      }

      if (
        !data.session &&
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        throw new AppError(
          'An account with this email already exists. Please log in instead.',
          409,
          'EMAIL_ALREADY_EXISTS'
        );
      }

      const verifiedImmediately = Boolean(data.user?.email_confirmed_at || data.session);
      return {
        message: verifiedImmediately
          ? 'Registration complete! Your account is ready—you can now log in.'
          : 'Registration successful! Please check your email inbox to verify your account.',
        email,
        requiresVerification: !verifiedImmediately,
      };
    }

    // Local SQLite mode
    const existing = await repository.getProfileByEmail(email);
    if (existing) {
      throw new AppError(
        'An account with this email already exists. Please log in instead.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const userId = createUuid();
    const passwordHash = hashPassword(input.password);
    await repository.createLocalProfile({
      id: userId,
      email,
      full_name: fullName,
      phone,
      password_hash: passwordHash,
      email_verified: false,
    });

    const { rawToken, tokenHash } = createVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await repository.storeLocalAuthToken({
      userId,
      tokenHash,
      tokenType: 'EMAIL_VERIFY',
      expiresAt,
    });

    const mailResult = await emailService.sendVerificationEmail(email, fullName, rawToken);
    const preview = emailService.getDevOutbox(email)[0];

    return {
      message:
        mailResult.deliveredVia === 'smtp'
          ? 'Account created! Please check your email inbox to verify your email address.'
          : 'Account created! Verify your email using the verification link (available in the Dev Email Outbox below if SMTP is not configured).',
      email,
      requiresVerification: true,
      verificationPreviewUrl:
        env.nodeEnv !== 'production' ? preview?.verificationUrl : undefined,
    };
  },

  /**
   * Verifies a user's email address using the one-time verification token.
   */
  async verifyEmail(rawToken: string): Promise<{ message: string; user: UserProfile }> {
    if (!rawToken || !rawToken.trim()) {
      throw new AppError('Verification token is required.', 400, 'MISSING_TOKEN');
    }

    if (env.provider === 'supabase') {
      // Support both Supabase access_token redirect (#access_token=...) and token_hash OTP
      if (rawToken.includes('.')) {
        const { data, error } = await getSupabaseAdmin().auth.getUser(rawToken.trim());
        if (error || !data.user) {
          throw new AppError(
            error?.message || 'Verification session is invalid or expired.',
            400,
            'INVALID_VERIFICATION_TOKEN'
          );
        }
        const updated = await repository.updateProfile(data.user.id, {
          email_verified: Boolean(data.user.email_confirmed_at),
        });
        if (!updated) throw new AppError('Profile record not found.', 404, 'NOT_FOUND');
        return {
          message: 'Email verified successfully! You can now log in and book tickets.',
          user: updated,
        };
      }

      const trimmed = rawToken.trim();
      const otpTypes: Array<'signup' | 'email' | 'magiclink'> = ['signup', 'email', 'magiclink'];
      let verifiedUser: { id: string } | null = null;
      let lastErrorMessage = 'Verification link is invalid or expired.';

      for (const otpType of otpTypes) {
        const { data, error } = await getSupabaseAnon().auth.verifyOtp({
          token_hash: trimmed,
          type: otpType,
        });
        if (!error && data.user) {
          verifiedUser = data.user;
          break;
        }
        if (error?.message) {
          lastErrorMessage = error.message;
        }
      }

      if (!verifiedUser) {
        throw new AppError(lastErrorMessage, 400, 'INVALID_VERIFICATION_TOKEN');
      }
      const updated = await repository.updateProfile(verifiedUser.id, {
        email_verified: true,
      });
      if (!updated) throw new AppError('Profile record not found.', 404, 'NOT_FOUND');
      return {
        message: 'Email verified successfully! You can now log in and book tickets.',
        user: updated,
      };
    }

    const tokenHash = hashToken(rawToken.trim());
    const consumed = await repository.consumeLocalAuthToken(tokenHash, 'EMAIL_VERIFY');
    if (!consumed) {
      throw new AppError(
        'This verification link is invalid or has expired. Please request a new one.',
        400,
        'INVALID_VERIFICATION_TOKEN'
      );
    }

    const updated = await repository.updateProfile(consumed.user_id, {
      email_verified: true,
    });
    if (!updated) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    return {
      message: 'Email verified successfully! You can now log in and book tickets.',
      user: updated,
    };
  },

  /**
   * Re-sends the verification email for an unverified user account.
   */
  async resendVerification(emailInput: string): Promise<{
    message: string;
    verificationPreviewUrl?: string;
  }> {
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      throw new AppError('Email address is required.', 400, 'VALIDATION_ERROR');
    }

    if (env.provider === 'supabase') {
      const profile = await repository.getProfileByEmail(email);
      if (!profile) {
        return { message: 'If an account exists for that email, a verification link has been sent.' };
      }
      if (profile.email_verified) {
        return { message: 'Your email is already verified. You can log in directly.' };
      }

      if (env.smtp.configured || env.nodeEnv !== 'production') {
        const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${env.clientUrl}/verify-email` },
        });
        if (error) throw new AppError(error.message, 400, 'RESEND_FAILED');
        const hashedToken = data.properties?.hashed_token;
        if (!hashedToken) {
          throw new AppError('Unable to generate verification link.', 500, 'RESEND_FAILED');
        }
        await emailService.sendVerificationEmail(profile.email, profile.full_name, hashedToken);
        const preview = emailService.getDevOutbox(profile.email)[0];
        return {
          message: 'A new verification email has been sent.',
          verificationPreviewUrl:
            env.nodeEnv !== 'production' ? preview?.verificationUrl : undefined,
        };
      }

      const { error } = await getSupabaseAnon().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${env.clientUrl}/verify-email` },
      });
      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message)) {
          throw new AppError(
            'Email delivery rate limit reached on Supabase default mailer. Configure SMTP_* settings for unlimited verification emails.',
            429,
            'EMAIL_RATE_LIMIT'
          );
        }
        throw new AppError(error.message, 400, 'RESEND_FAILED');
      }
      return { message: 'Verification email re-sent. Please check your inbox.' };
    }

    const profile = await repository.getProfileByEmail(email);
    if (!profile) {
      return { message: 'If an account exists for that email, a verification link has been sent.' };
    }
    if (profile.email_verified) {
      return { message: 'Your email is already verified. You can log in directly.' };
    }

    const { rawToken, tokenHash } = createVerificationToken();
    await repository.storeLocalAuthToken({
      userId: profile.id,
      tokenHash,
      tokenType: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await emailService.sendVerificationEmail(profile.email, profile.full_name, rawToken);
    const preview = emailService.getDevOutbox(profile.email)[0];

    return {
      message: 'A new verification email has been sent.',
      verificationPreviewUrl:
        env.nodeEnv !== 'production' ? preview?.verificationUrl : undefined,
    };
  },

  /**
   * Authenticates a user with email & password and returns a session JWT + profile.
   * Blocks unverified accounts with a clear `EMAIL_NOT_VERIFIED` code so the UI can
   * offer an instant "Resend verification email" action.
   */
  async login(emailInput: string, password: string): Promise<AuthResponse> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400, 'VALIDATION_ERROR');
    }

    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAnon().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          throw new AppError(
            'Please verify your email address before logging in.',
            403,
            'EMAIL_NOT_VERIFIED'
          );
        }
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }
      if (!data.session || !data.user) {
        throw new AppError('Unable to establish session.', 401, 'INVALID_CREDENTIALS');
      }

      const profile = await repository.getProfileById(data.user.id);
      if (!profile) {
        throw new AppError('Profile record missing for this account.', 404, 'PROFILE_NOT_FOUND');
      }
      const { password_hash: _ignored, ...safeProfile } = profile;
      return {
        user: safeProfile,
        accessToken: data.session.access_token,
        provider: 'supabase',
      };
    }

    const userRecord = await repository.getProfileByEmail(email);
    if (!userRecord || !userRecord.password_hash) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = verifyPassword(password, userRecord.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!userRecord.email_verified) {
      throw new AppError(
        'Your email address is not verified yet. Please verify your email before logging in.',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }

    const accessToken = signLocalJwt({
      sub: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      email_verified: userRecord.email_verified,
    });

    const { password_hash: _ignored, ...safeProfile } = userRecord;
    return {
      user: safeProfile,
      accessToken,
      provider: 'local',
    };
  },

  /**
   * Initiates password reset flow by sending a 1-hour reset token strictly via email.
   * Never exposes reset URLs in the HTTP response so only the inbox owner can reset.
   */
  async forgotPassword(emailInput: string): Promise<{
    message: string;
  }> {
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      throw new AppError('Please enter your registered email address.', 400, 'VALIDATION_ERROR');
    }

    const neutralResponse = {
      message: 'If an account exists for that email, password reset instructions have been sent.',
    };

    if (env.provider === 'supabase') {
      if (env.smtp.configured) {
        const profile = await repository.getProfileByEmail(email);
        if (!profile) {
          return neutralResponse;
        }
        const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${env.clientUrl}/reset-password` },
        });
        if (error) throw new AppError(error.message, 400, 'RESET_EMAIL_FAILED');
        const hashedToken = data.properties?.hashed_token;
        if (!hashedToken) {
          throw new AppError('Unable to generate reset link.', 500, 'RESET_EMAIL_FAILED');
        }
        await emailService.sendPasswordResetEmail(profile.email, profile.full_name, hashedToken);
        return neutralResponse;
      }

      const { error } = await getSupabaseAnon().auth.resetPasswordForEmail(email, {
        redirectTo: `${env.clientUrl}/reset-password`,
      });
      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message)) {
          throw new AppError(
            'Email delivery limit reached. Configure SMTP_* settings to send unlimited reset emails.',
            429,
            'EMAIL_RATE_LIMIT'
          );
        }
        throw new AppError(error.message, 400, 'RESET_EMAIL_FAILED');
      }
      return neutralResponse;
    }

    const profile = await repository.getProfileByEmail(email);
    if (!profile) {
      return neutralResponse;
    }

    const { rawToken, tokenHash } = createVerificationToken();
    await repository.storeLocalAuthToken({
      userId: profile.id,
      tokenHash,
      tokenType: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await emailService.sendPasswordResetEmail(profile.email, profile.full_name, rawToken);

    return neutralResponse;
  },

  /**
   * Completes password reset using the reset token and a new password.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400, 'VALIDATION_ERROR');
    }

    if (env.provider === 'supabase') {
      const trimmed = rawToken.trim();
      let targetUserId: string | undefined;

      if (trimmed.includes('.')) {
        const { data: userData, error: userErr } = await getSupabaseAdmin().auth.getUser(trimmed);
        if (!userErr && userData.user) {
          targetUserId = userData.user.id;
        }
      } else {
        const { data: otpData, error: otpErr } = await getSupabaseAnon().auth.verifyOtp({
          token_hash: trimmed,
          type: 'recovery',
        });
        if (!otpErr && otpData.user) {
          targetUserId = otpData.user.id;
        }
      }

      if (!targetUserId) {
        throw new AppError(
          'Password reset link is invalid or expired.',
          400,
          'INVALID_RESET_TOKEN'
        );
      }
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (error) throw new AppError(error.message, 400, 'PASSWORD_RESET_FAILED');
      return {
        message: 'Your password has been reset. You can now log in with your new password.',
      };
    }

    const tokenHash = hashToken(rawToken.trim());
    const consumed = await repository.consumeLocalAuthToken(tokenHash, 'PASSWORD_RESET');
    if (!consumed) {
      throw new AppError('Password reset link is invalid or expired.', 400, 'INVALID_RESET_TOKEN');
    }

    await repository.updateLocalPassword(consumed.user_id, hashPassword(newPassword));
    return { message: 'Your password has been reset. You can now log in with your new password.' };
  },

  /**
   * Allows a logged-in user to change their password from their Dashboard.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters.', 400, 'VALIDATION_ERROR');
    }

    if (env.provider === 'supabase') {
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) throw new AppError(error.message, 400, 'PASSWORD_UPDATE_FAILED');
      return { message: 'Password updated successfully.' };
    }

    const profile = await repository.getProfileById(userId);
    if (!profile || !profile.password_hash) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }
    if (!verifyPassword(currentPassword, profile.password_hash)) {
      throw new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    await repository.updateLocalPassword(userId, hashPassword(newPassword));
    return { message: 'Password changed successfully.' };
  },
};
