/**
 * Servicio de OAuth2
 * Maneja la autenticación OAuth2 para Gmail y Outlook
 */

const { google } = require('googleapis');
const axios = require('axios');

class OAuth2Service {
  constructor() {
    // Configuración de Google
    this.googleOAuth2Client = null;
    
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.googleOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
      );
    }

    // Configuración de Microsoft/Outlook
    this.outlookConfig = {
      clientId: process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
      redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/auth/outlook/callback',
      authority: 'https://login.microsoftonline.com/common',
      scopes: ['IMAP.AccessAsUser.All', 'SMTP.Send', 'offline_access']
    };
  }

  /**
   * Genera URL de autorización para Google
   * @returns {string} - URL de autorización
   */
  getGoogleAuthUrl() {
    if (!this.googleOAuth2Client) {
      throw new Error('Configuración de Google OAuth2 no disponible');
    }

    const scopes = [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose'
    ];

    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Para obtener refresh token
    });
  }

  /**
   * Intercambia código por tokens de Google
   * @param {string} code - Código de autorización
   * @returns {Promise<Object>} - Tokens obtenidos
   */
  async getGoogleTokens(code) {
    if (!this.googleOAuth2Client) {
      throw new Error('Configuración de Google OAuth2 no disponible');
    }

    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      
      // Obtener información del usuario
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(tokens);
      
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture
      };
    } catch (error) {
      console.error('Error obteniendo tokens de Google:', error);
      throw new Error(`No se pudo obtener tokens de Google: ${error.message}`);
    }
  }

  /**
   * Refresca token de acceso de Google
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - Nuevos tokens
   */
  async refreshGoogleToken(refreshToken) {
    if (!this.googleOAuth2Client) {
      throw new Error('Configuración de Google OAuth2 no disponible');
    }

    try {
      this.googleOAuth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();
      
      return {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date
      };
    } catch (error) {
      console.error('Error refrescando token de Google:', error);
      throw new Error(`No se pudo refrescar el token de Google: ${error.message}`);
    }
  }

  /**
   * Genera URL de autorización para Outlook/Microsoft
   * @returns {string} - URL de autorización
   */
  getOutlookAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.outlookConfig.clientId,
      response_type: 'code',
      redirect_uri: this.outlookConfig.redirectUri,
      scope: this.outlookConfig.scopes.join(' '),
      response_mode: 'query',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.outlookConfig.authority}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Intercambia código por tokens de Outlook
   * @param {string} code - Código de autorización
   * @returns {Promise<Object>} - Tokens obtenidos
   */
  async getOutlookTokens(code) {
    try {
      const response = await axios.post(
        `${this.outlookConfig.authority}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.outlookConfig.clientId,
          client_secret: this.outlookConfig.clientSecret,
          scope: this.outlookConfig.scopes.join(' '),
          code: code,
          redirect_uri: this.outlookConfig.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Obtener información del usuario
      const userResponse = await axios.get(
        'https://graph.microsoft.com/v1.0/me',
        {
          headers: {
            'Authorization': `Bearer ${response.data.access_token}`
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiryDate: Date.now() + (response.data.expires_in * 1000),
        email: userResponse.data.mail || userResponse.data.userPrincipalName,
        name: userResponse.data.displayName
      };
    } catch (error) {
      console.error('Error obteniendo tokens de Outlook:', error);
      throw new Error(`No se pudo obtener tokens de Outlook: ${error.message}`);
    }
  }

  /**
   * Refresca token de acceso de Outlook
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - Nuevos tokens
   */
  async refreshOutlookToken(refreshToken) {
    try {
      const response = await axios.post(
        `${this.outlookConfig.authority}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.outlookConfig.clientId,
          client_secret: this.outlookConfig.clientSecret,
          scope: this.outlookConfig.scopes.join(' '),
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiryDate: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      console.error('Error refrescando token de Outlook:', error);
      throw new Error(`No se pudo refrescar el token de Outlook: ${error.message}`);
    }
  }

  /**
   * Verifica si un token está expirado
   * @param {number} expiryDate - Fecha de expiración en timestamp
   * @returns {boolean} - true si está expirado
   */
  isTokenExpired(expiryDate) {
    if (!expiryDate) return true;
    // Considerar expirado 5 minutos antes para tener margen
    return Date.now() >= (expiryDate - 5 * 60 * 1000);
  }

  /**
   * Obtiene configuración IMAP/SMTP para una cuenta OAuth2
   * @param {string} provider - 'gmail' o 'outlook'
   * @param {string} email - Email del usuario
   * @returns {Object} - Configuración de servidores
   */
  getProviderConfig(provider, email) {
    const configs = {
      gmail: {
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false, // STARTTLS
        authType: 'oauth2'
      },
      outlook: {
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false, // STARTTLS
        authType: 'oauth2'
      },
      yahoo: {
        imapHost: 'imap.mail.yahoo.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: 465,
        smtpSecure: true,
        authType: 'oauth2'
      }
    };

    return configs[provider] || null;
  }

  /**
   * Detecta el proveedor basado en el email
   * @param {string} email - Dirección de email
   * @returns {string|null} - Proveedor detectado
   */
  detectProvider(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) return null;

    if (domain.includes('gmail.com') || domain.includes('googlemail.com')) {
      return 'gmail';
    } else if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) {
      return 'outlook';
    } else if (domain.includes('yahoo.com')) {
      return 'yahoo';
    }
    
    return null;
  }
}

module.exports = new OAuth2Service();
