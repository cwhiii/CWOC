package com.cwoc.app.data.repository

/**
 * Interface for emitting auth events (e.g., token revocation).
 *
 * This breaks the circular dependency between NetworkModule (which provides
 * TokenAuthenticator) and AuthRepository (which needs ApiService from NetworkModule).
 * TokenAuthenticator calls this interface; AuthRepository implements it.
 */
interface AuthEventEmitter {
    fun emitTokenRevokedSync()
}
