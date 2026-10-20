import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../../config/env";

// ── Password helpers ──────────────────────────────────────────

export const hashPassword = (plaintext: string): Promise<string> => {
  return bcrypt.hash(plaintext, env.SALT_ROUNDS);
};

export const verifyPassword = (
  plaintext: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(plaintext, hash);
};

export const hashRefreshToken = (token: string): Promise<string> => {
  return bcrypt.hash(token, 8); // lower rounds — tokens are long random strings
};

export const verifyRefreshTokenHash = (
  token: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(token, hash);
};

// ── Token generation ──────────────────────────────────────────

interface TokenPayload {
  id: number;
  uuid: string;
  user_type: string;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: string;
  sid: string;
}

export const generateTokenPair = (payload: TokenPayload): TokenPair => {
  const sid = randomUUID();

  const access_token = jwt.sign(
    { ...payload, typ: "access" },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
      algorithm: "HS256",
    },
  );

  const refresh_token = jwt.sign(
    { sub: payload.uuid, sid, typ: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.REFRESH_TOKEN_EXPIRES_IN_DAYS}d`, algorithm: "HS256" },
  );

  return {
    access_token,
    refresh_token,
    token_type: "Bearer",
    expires_in: env.ACCESS_TOKEN_EXPIRES_IN,
    sid,
  };
};
