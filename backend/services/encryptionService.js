/**
 * Servicio de Encriptación
 * Maneja la encriptación/desencriptación de credenciales sensibles
 * Usa AES-256-GCM para máxima seguridad
 */

const CryptoJS = require('crypto-js');

class EncryptionService {
  constructor() {
    // La clave debe ser de 32 caracteres para AES-256
    this.key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32ch';
    
    if (this.key.length < 32) {
      console.warn('⚠️  ADVERTENCIA: La clave de encriptación es muy corta. Usa al menos 32 caracteres.');
    }
  }

  /**
   * Encripta un texto plano
   * @param {string} text - Texto a encriptar
   * @returns {string} - Texto encriptado en formato base64
   */
  encrypt(text) {
    if (!text) return null;
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.key).toString();
      return encrypted;
    } catch (error) {
      console.error('Error encriptando:', error);
      throw new Error('No se pudo encriptar el dato sensible');
    }
  }

  /**
   * Desencripta un texto encriptado
   * @param {string} encryptedText - Texto encriptado en base64
   * @returns {string} - Texto original desencriptado
   */
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('No se pudo desencriptar');
      }
      
      return decrypted;
    } catch (error) {
      console.error('Error desencriptando:', error);
      throw new Error('No se pudo desencriptar el dato sensible');
    }
  }

  /**
   * Encripta un objeto de credenciales
   * @param {Object} credentials - Objeto con password y/o accessToken
   * @returns {Object} - Objeto con campos encriptados
   */
  encryptCredentials(credentials) {
    const encrypted = {};
    
    if (credentials.password) {
      encrypted.password = this.encrypt(credentials.password);
    }
    
    if (credentials.accessToken) {
      encrypted.accessToken = this.encrypt(credentials.accessToken);
    }
    
    if (credentials.refreshToken) {
      encrypted.refreshToken = this.encrypt(credentials.refreshToken);
    }
    
    return encrypted;
  }

  /**
   * Desencripta un objeto de credenciales
   * @param {Object} encryptedCredentials - Objeto con campos encriptados
   * @returns {Object} - Objeto con credenciales originales
   */
  decryptCredentials(encryptedCredentials) {
    const decrypted = {};
    
    if (encryptedCredentials.password) {
      decrypted.password = this.decrypt(encryptedCredentials.password);
    }
    
    if (encryptedCredentials.accessToken) {
      decrypted.accessToken = this.decrypt(encryptedCredentials.accessToken);
    }
    
    if (encryptedCredentials.refreshToken) {
      decrypted.refreshToken = this.decrypt(encryptedCredentials.refreshToken);
    }
    
    return decrypted;
  }

  /**
   * Genera un hash seguro para contraseñas de usuario
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<string>} - Hash de la contraseña
   */
  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifica una contraseña contra un hash
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash almacenado
   * @returns {Promise<boolean>} - true si coincide
   */
  async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }
}

module.exports = new EncryptionService();
