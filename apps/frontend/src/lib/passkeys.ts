import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
} from '@simplewebauthn/browser';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '@/lib/api-client';
import type { PublicUser } from '@/types/api';

export interface PasskeyInfo {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    backedUp: boolean;
}

export const passkeysSupported = (): boolean => browserSupportsWebAuthn();

/** Asks the browser for a passkey and finishes the sign-in on the server. */
export async function signInWithPasskey(): Promise<PublicUser> {
    const { ceremonyId, options } = await api.post<{
        ceremonyId: string;
        options: PublicKeyCredentialRequestOptionsJSON;
    }>('/auth/passkey/options', {});
    const response = await startAuthentication({ optionsJSON: options });
    const result = await api.post<{ user: PublicUser }>('/auth/passkey/login', {
        ceremonyId,
        response,
    });
    return result.user;
}

/** Creates a passkey for the signed-in account. */
export async function addPasskey(name: string): Promise<PasskeyInfo> {
    const { ceremonyId, options } = await api.post<{
        ceremonyId: string;
        options: PublicKeyCredentialCreationOptionsJSON;
    }>('/users/me/passkeys/register/options', {});
    const response = await startRegistration({ optionsJSON: options });
    const result = await api.post<{ passkey: PasskeyInfo }>('/users/me/passkeys/register', {
        ceremonyId,
        name,
        response,
    });
    return result.passkey;
}

export const listPasskeys = async (): Promise<PasskeyInfo[]> =>
    (await api.get<{ passkeys: PasskeyInfo[] }>('/users/me/passkeys')).passkeys;

export const removePasskey = (id: string): Promise<void> =>
    api.delete<void>('/users/me/passkeys/' + id);
