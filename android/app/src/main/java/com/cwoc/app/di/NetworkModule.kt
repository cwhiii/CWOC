package com.cwoc.app.di

import android.content.SharedPreferences
import com.cwoc.app.data.remote.AuthInterceptor
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.TokenAuthenticator
import com.cwoc.app.data.repository.AuthEventEmitter
import com.cwoc.app.data.repository.AuthRepository
import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideGson(): Gson {
        return Gson()
    }

    @Provides
    @Singleton
    fun provideAuthInterceptor(prefs: SharedPreferences): AuthInterceptor {
        return AuthInterceptor(prefs)
    }

    /**
     * Provides AuthEventEmitter binding.
     * AuthRepository implements AuthEventEmitter, so we use a Lazy<AuthRepository>
     * to break the circular dependency (AuthRepository → ApiService → OkHttp → TokenAuthenticator → AuthEventEmitter).
     */
    @Provides
    @Singleton
    fun provideAuthEventEmitter(authRepository: dagger.Lazy<AuthRepository>): AuthEventEmitter {
        return object : AuthEventEmitter {
            override fun emitTokenRevokedSync() {
                authRepository.get().emitTokenRevokedSync()
            }
        }
    }

    @Provides
    @Singleton
    fun provideTokenAuthenticator(
        prefs: SharedPreferences,
        authEventEmitter: dagger.Lazy<AuthEventEmitter>
    ): TokenAuthenticator {
        return TokenAuthenticator(prefs) {
            // Wire the callback to emit token revocation event
            authEventEmitter.get().emitTokenRevokedSync()
        }
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient {
        // Trust all certificates (needed for self-signed HTTPS on local server)
        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })

        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustAllCerts, SecureRandom())

        return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true }
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .authenticator(tokenAuthenticator)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        prefs: SharedPreferences
    ): Retrofit {
        val baseUrl = prefs.getString("server_url", "http://localhost:3333")
            ?: "http://localhost:3333"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideCwocApiService(retrofit: Retrofit): CwocApiService {
        return retrofit.create(CwocApiService::class.java)
    }
}
