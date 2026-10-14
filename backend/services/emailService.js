/**
 * Servicio de Email
 * Maneja operaciones IMAP (recepción) y SMTP (envío) usando nodemailer e imap-simple
 */

const nodemailer = require('nodemailer');
const ImapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');
const encryptionService = require('./encryptionService');

class EmailService {
  constructor() {
    this.connections = new Map(); // Cache de conexiones IMAP
  }

  /**
   * Crea un transporter de Nodemailer para SMTP
   * @param {Object} account - Cuenta con credenciales desencriptadas
   * @returns {Object} - Transporter de nodemailer
   */
  createSMTPTransport(account) {
    const config = {
      host: account.smtpHost,
      port: account.smtpPort || 587,
      secure: account.smtpSecure || false,
      auth: {
        user: account.email,
        pass: account.password
      }
    };

    // Configuración especial para OAuth2
    if (account.authType === 'oauth2' && account.accessToken) {
      config.auth = {
        type: 'OAuth2',
        user: account.email,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken
      };
    }

    return nodemailer.createTransport(config);
  }

  /**
   * Conecta a un servidor IMAP
   * @param {Object} account - Cuenta con credenciales desencriptadas
   * @returns {Promise<Object>} - Conexión IMAP
   */
  async connectIMAP(account) {
    const config = {
      imap: {
        user: account.email,
        password: account.password,
        host: account.imapHost,
        port: account.imapPort || 993,
        tls: account.imapSecure !== false,
        tlsOptions: { rejectUnauthorized: false }, // Para certificados autofirmados
        authTimeout: 3000,
        connTimeout: 10000,
        onerror: (err) => console.error('IMAP Error:', err)
      }
    };

    // Configuración especial para OAuth2
    if (account.authType === 'oauth2' && account.accessToken) {
      config.imap.auth = {
        type: 'OAuth2',
        user: account.email,
        accessToken: account.accessToken
      };
      delete config.imap.password;
    }

    try {
      const connection = await ImapSimple.connect(config);
      return connection;
    } catch (error) {
      console.error('Error conectando a IMAP:', error);
      throw new Error(`No se pudo conectar al servidor IMAP: ${error.message}`);
    }
  }

  /**
   * Obtiene o crea una conexión IMAP cacheada
   * @param {string} accountId - ID de la cuenta
   * @param {Object} account - Cuenta con credenciales
   * @returns {Promise<Object>} - Conexión IMAP
   */
  async getOrCreateConnection(accountId, account) {
    // Verificar si existe conexión cacheada
    if (this.connections.has(accountId)) {
      const connection = this.connections.get(accountId);
      
      // Verificar que la conexión siga viva
      try {
        await connection.ping();
        return connection;
      } catch (error) {
        // Conexión muerta, eliminar del cache
        this.connections.delete(accountId);
      }
    }

    // Crear nueva conexión
    const connection = await this.connectIMAP(account);
    this.connections.set(accountId, connection);
    
    // Listener para cuando se cierre la conexión
    connection.on('close', () => {
      this.connections.delete(accountId);
      console.log(`Conexión IMAP cerrada para cuenta: ${accountId}`);
    });

    return connection;
  }

  /**
   * Lista los emails de una carpeta
   * @param {Object} account - Cuenta de email
   * @param {string} folder - Carpeta a listar (por defecto INBOX)
   * @param {number} limit - Límite de emails a retornar
   * @returns {Promise<Array>} - Lista de emails
   */
  async listEmails(account, folder = 'INBOX', limit = 50) {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      // Abrir la carpeta
      await connection.openBox(folder);
      
      // Buscar todos los mensajes
      const searchCriteria = ['ALL'];
      const fetchOptions = {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)'],
        struct: true,
        markSeen: false // No marcar como leído
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      // Procesar y limitar resultados
      const emails = messages.slice(-limit).reverse().map((msg) => {
        const headers = msg.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)');
        const headerObj = this.parseHeaders(headers.body);
        
        return {
          id: msg.attributes.uid,
          messageId: headerObj['message-id']?.replace(/[<>]/g, '') || null,
          from: headerObj.from || 'Desconocido',
          to: headerObj.to || '',
          subject: headerObj.subject || '(Sin asunto)',
          date: headerObj.date ? new Date(headerObj.date) : new Date(),
          flags: msg.attributes.flags,
          seen: msg.attributes.flags.includes('\\Seen')
        };
      });

      return emails;
    } catch (error) {
      console.error('Error listando emails:', error);
      throw new Error(`No se pudieron listar los emails: ${error.message}`);
    }
  }

  /**
   * Obtiene un email completo por su UID
   * @param {Object} account - Cuenta de email
   * @param {number} uid - UID del email
   * @param {string} folder - Carpeta donde está el email
   * @returns {Promise<Object>} - Email completo parseado
   */
  async getEmail(account, uid, folder = 'INBOX') {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      await connection.openBox(folder);
      
      const searchCriteria = [[`UID`, uid]];
      const fetchOptions = {
        bodies: [''],
        struct: true
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      if (messages.length === 0) {
        throw new Error('Email no encontrado');
      }

      const msg = messages[0];
      const bodyPart = msg.parts.find(part => part.which === '');
      
      if (!bodyPart) {
        throw new Error('No se pudo obtener el cuerpo del email');
      }

      // Parsear el email completo con mailparser
      const rawEmail = bodyPart.body;
      const parsed = await simpleParser(rawEmail);

      // Marcar como leído
      await connection.setFlags([uid], ['\\Seen']);

      return {
        id: uid,
        messageId: parsed.messageId,
        from: this.formatAddress(parsed.from),
        to: this.formatAddresses(parsed.to),
        cc: this.formatAddresses(parsed.cc),
        subject: parsed.subject,
        date: parsed.date,
        text: parsed.text,
        html: parsed.html,
        attachments: parsed.attachments.map(att => ({
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          contentId: att.contentId
        })),
        headers: parsed.headers,
        flags: msg.attributes.flags,
        seen: msg.attributes.flags.includes('\\Seen')
      };
    } catch (error) {
      console.error('Error obteniendo email:', error);
      throw new Error(`No se pudo obtener el email: ${error.message}`);
    }
  }

  /**
   * Envía un email
   * @param {Object} account - Cuenta de email
   * @param {Object} emailData - Datos del email a enviar
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendEmail(account, emailData) {
    const transporter = this.createSMTPTransport(account);
    
    try {
      const mailOptions = {
        from: account.email,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        inReplyTo: emailData.inReplyTo,
        references: emailData.references
      };

      // Añadir adjuntos si existen
      if (emailData.attachments && emailData.attachments.length > 0) {
        mailOptions.attachments = emailData.attachments;
      }

      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Email enviado correctamente'
      };
    } catch (error) {
      console.error('Error enviando email:', error);
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    } finally {
      // Cerrar transporter
      await transporter.close();
    }
  }

  /**
   * Marca un email como leído/no leído
   * @param {Object} account - Cuenta de email
   * @param {number} uid - UID del email
   * @param {boolean} seen - true para marcado como leído
   * @param {string} folder - Carpeta del email
   */
  async markAsRead(account, uid, seen = true, folder = 'INBOX') {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      await connection.openBox(folder);
      const flags = seen ? ['\\Seen'] : ['\\Unseen'];
      await connection.addFlags([uid], flags);
      return { success: true };
    } catch (error) {
      console.error('Error marcando email:', error);
      throw new Error(`No se pudo actualizar el estado del email: ${error.message}`);
    }
  }

  /**
   * Elimina un email (lo marca para eliminación)
   * @param {Object} account - Cuenta de email
   * @param {number} uid - UID del email
   * @param {string} folder - Carpeta del email
   */
  async deleteEmail(account, uid, folder = 'INBOX') {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      await connection.openBox(folder);
      await connection.addFlags([uid], ['\\Deleted']);
      await connection.expunge(); // Eliminar permanentemente
      return { success: true };
    } catch (error) {
      console.error('Error eliminando email:', error);
      throw new Error(`No se pudo eliminar el email: ${error.message}`);
    }
  }

  /**
   * Mueve un email a otra carpeta
   * @param {Object} account - Cuenta de email
   * @param {number} uid - UID del email
   * @param {string} destination - Carpeta destino
   * @param {string} folder - Carpeta origen
   */
  async moveEmail(account, uid, destination, folder = 'INBOX') {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      await connection.openBox(folder);
      await connection.moveMessage(uid, destination);
      return { success: true };
    } catch (error) {
      console.error('Error moviendo email:', error);
      throw new Error(`No se pudo mover el email: ${error.message}`);
    }
  }

  /**
   * Lista las carpetas disponibles
   * @param {Object} account - Cuenta de email
   * @returns {Promise<Array>} - Lista de carpetas
   */
  async listFolders(account) {
    const connection = await this.getOrCreateConnection(account.id, account);
    
    try {
      const boxes = await connection.getBoxes();
      return this.flattenBoxes(boxes);
    } catch (error) {
      console.error('Error listando carpetas:', error);
      throw new Error(`No se pudieron listar las carpetas: ${error.message}`);
    }
  }

  /**
   * Parsea headers IMAP a objeto
   * @param {string} headerText - Texto de headers
   * @returns {Object} - Objeto con headers parseados
   */
  parseHeaders(headerText) {
    const headers = {};
    const lines = headerText.split('\r\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    return headers;
  }

  /**
   * Formatea una dirección de email
   * @param {Object|Array} address - Dirección de mailparser
   * @returns {string} - Dirección formateada
   */
  formatAddress(address) {
    if (!address) return '';
    if (Array.isArray(address)) {
      return address.map(a => `${a.name ? `"${a.name}" ` : ''}<${a.address}>`).join(', ');
    }
    return `${address.name ? `"${address.name}" ` : ''}<${address.address}>`;
  }

  /**
   * Formatea múltiples direcciones
   * @param {Object|Array} addresses - Direcciones de mailparser
   * @returns {string} - Direcciones formateadas
   */
  formatAddresses(addresses) {
    if (!addresses) return '';
    return this.formatAddress(addresses);
  }

  /**
   * Aplana la estructura de cajas IMAP
   * @param {Object} boxes - Estructura de cajas anidadas
   * @returns {Array} - Array plano de nombres de carpetas
   */
  flattenBoxes(boxes, prefix = '') {
    let result = [];
    
    for (const [name, box] of Object.entries(boxes)) {
      const fullName = prefix ? `${prefix}.${name}` : name;
      result.push(fullName);
      
      if (box.children) {
        result = result.concat(this.flattenBoxes(box.children, fullName));
      }
    }
    
    return result;
  }

  /**
   * Cierra todas las conexiones IMAP
   */
  async closeAllConnections() {
    for (const [accountId, connection] of this.connections.entries()) {
      try {
        await connection.end();
        this.connections.delete(accountId);
      } catch (error) {
        console.error(`Error cerrando conexión ${accountId}:`, error);
      }
    }
  }
}

module.exports = new EmailService();
