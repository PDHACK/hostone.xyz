/**
 * Controlador de Emails
 * Maneja las operaciones de listar, leer, enviar y gestionar emails
 */

const emailService = require('../services/emailService');
const encryptionService = require('../services/encryptionService');
const db = require('../config/database');

/**
 * Lista los emails de una cuenta
 * GET /api/emails/:accountId
 */
const listEmails = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { folder = 'INBOX', limit = 50 } = req.query;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Listar emails
    const emails = await emailService.listEmails(
      accountWithCredentials,
      folder,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        emails,
        folder,
        total: emails.length
      }
    });
  } catch (error) {
    console.error('Error listando emails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtiene un email específico
 * GET /api/emails/:accountId/:uid
 */
const getEmail = async (req, res) => {
  try {
    const { accountId, uid } = req.params;
    const { folder = 'INBOX' } = req.query;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Obtener email
    const email = await emailService.getEmail(
      accountWithCredentials,
      parseInt(uid),
      folder
    );

    res.json({
      success: true,
      data: email
    });
  } catch (error) {
    console.error('Error obteniendo email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Envía un email
 * POST /api/emails/:accountId/send
 */
const sendEmail = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { to, cc, bcc, subject, text, html, inReplyTo, references } = req.body;

    // Validaciones básicas
    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "subject" son requeridos'
      });
    }

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Enviar email
    const result = await emailService.sendEmail(accountWithCredentials, {
      to,
      cc,
      bcc,
      subject,
      text,
      html: html || text, // Si no hay HTML, usar texto plano
      inReplyTo,
      references
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error enviando email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Marca un email como leído/no leído
 * PATCH /api/emails/:accountId/:uid/read
 */
const markAsRead = async (req, res) => {
  try {
    const { accountId, uid } = req.params;
    const { folder = 'INBOX', seen = true } = req.query;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Marcar como leído
    const result = await emailService.markAsRead(
      accountWithCredentials,
      parseInt(uid),
      seen === 'true',
      folder
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error marcando email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Elimina un email
 * DELETE /api/emails/:accountId/:uid
 */
const deleteEmail = async (req, res) => {
  try {
    const { accountId, uid } = req.params;
    const { folder = 'INBOX' } = req.query;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Eliminar email
    const result = await emailService.deleteEmail(
      accountWithCredentials,
      parseInt(uid),
      folder
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error eliminando email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Mueve un email a otra carpeta
 * POST /api/emails/:accountId/:uid/move
 */
const moveEmail = async (req, res) => {
  try {
    const { accountId, uid } = req.params;
    const { destination, folder = 'INBOX' } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'El campo "destination" es requerido'
      });
    }

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Mover email
    const result = await emailService.moveEmail(
      accountWithCredentials,
      parseInt(uid),
      destination,
      folder
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error moviendo email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Lista las carpetas disponibles
 * GET /api/emails/:accountId/folders
 */
const listFolders = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(accountId);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Listar carpetas
    const folders = await emailService.listFolders(accountWithCredentials);

    res.json({
      success: true,
      data: { folders }
    });
  } catch (error) {
    console.error('Error listando carpetas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  listEmails,
  getEmail,
  sendEmail,
  markAsRead,
  deleteEmail,
  moveEmail,
  listFolders
};
