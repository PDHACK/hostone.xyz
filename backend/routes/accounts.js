/**
 * Rutas de Cuentas de Email
 * Maneja la configuración de cuentas IMAP/SMTP
 */

const express = require('express');
const router = express.Router();
const encryptionService = require('../services/encryptionService');
const emailService = require('../services/emailService');
const oauth2Service = require('../services/oauth2Service');
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

/**
 * @route   GET /api/accounts
 * @desc    Lista todas las cuentas del usuario
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const accounts = await db.emailAccount.findByUserId(req.user.id);
    
    // No devolver credenciales encriptadas
    const sanitizedAccounts = accounts.map(acc => ({
      id: acc.id,
      email: acc.email,
      name: acc.name,
      provider: acc.provider,
      authType: acc.authType,
      imapHost: acc.imapHost,
      smtpHost: acc.smtpHost,
      createdAt: acc.createdAt
    }));

    res.json({
      success: true,
      data: { accounts: sanitizedAccounts }
    });
  } catch (error) {
    console.error('Error listando cuentas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/accounts
 * @desc    Crea una nueva cuenta de email
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name,
      imapHost, 
      imapPort, 
      imapSecure,
      smtpHost, 
      smtpPort, 
      smtpSecure,
      authType = 'password',
      accessToken,
      refreshToken,
      expiryDate
    } = req.body;

    // Validaciones básicas
    if (!email || (!password && authType === 'password')) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos para autenticación básica'
      });
    }

    // Detectar proveedor automáticamente si no se especifica
    let provider = req.body.provider;
    if (!provider) {
      provider = oauth2Service.detectProvider(email) || 'custom';
    }

    // Si es OAuth2, obtener configuración del proveedor
    let accountConfig = {
      imapHost,
      imapPort: imapPort || (imapSecure !== false ? 993 : 143),
      imapSecure: imapSecure !== false,
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpSecure: smtpSecure || false,
      authType
    };

    // Configuración automática para proveedores conocidos
    if (['gmail', 'outlook', 'yahoo'].includes(provider)) {
      const providerConfig = oauth2Service.getProviderConfig(provider, email);
      if (providerConfig) {
        accountConfig = { ...providerConfig, ...accountConfig };
      }
    }

    // Encriptar credenciales
    const encryptedCredentials = encryptionService.encryptCredentials({
      password,
      accessToken,
      refreshToken
    });

    // Crear cuenta
    const account = await db.emailAccount.create({
      userId: req.user.id,
      email,
      name: name || email.split('@')[0],
      provider,
      ...accountConfig,
      ...encryptedCredentials,
      expiryDate
    });

    res.status(201).json({
      success: true,
      data: {
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          provider: account.provider,
          authType: account.authType
        }
      },
      message: 'Cuenta agregada exitosamente'
    });
  } catch (error) {
    console.error('Error creando cuenta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/accounts/:id
 * @desc    Actualiza una cuenta existente
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(id);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Encriptar nuevas credenciales si se proporcionan
    if (updateData.password || updateData.accessToken || updateData.refreshToken) {
      const encryptedCredentials = encryptionService.encryptCredentials({
        password: updateData.password,
        accessToken: updateData.accessToken,
        refreshToken: updateData.refreshToken
      });
      Object.assign(updateData, encryptedCredentials);
      delete updateData.password;
      delete updateData.accessToken;
      delete updateData.refreshToken;
    }

    // Actualizar cuenta
    const updatedAccount = await db.emailAccount.update(id, updateData);

    res.json({
      success: true,
      data: {
        account: {
          id: updatedAccount.id,
          email: updatedAccount.email,
          name: updatedAccount.name,
          provider: updatedAccount.provider
        }
      },
      message: 'Cuenta actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Elimina una cuenta
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(id);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Eliminar cuenta
    await db.emailAccount.delete(id);

    res.json({
      success: true,
      message: 'Cuenta eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/accounts/:id/test
 * @desc    Prueba la conexión a una cuenta
 * @access  Private
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la cuenta pertenece al usuario
    const account = await db.emailAccount.findById(id);
    
    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    // Desencriptar credenciales
    const credentials = encryptionService.decryptCredentials(account);
    const accountWithCredentials = { ...account, ...credentials };

    // Probar conexión IMAP
    try {
      const connection = await emailService.connectIMAP(accountWithCredentials);
      await connection.end();
      
      res.json({
        success: true,
        data: {
          imap: 'connected',
          message: 'Conexión IMAP exitosa'
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: `Error conectando a IMAP: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Error testeando cuenta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/accounts/providers
 * @desc    Lista proveedores soportados con su configuración
 * @access  Private
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = {
      gmail: {
        name: 'Gmail',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        authTypes: ['oauth2', 'password'],
        notes: 'Para password: usar App Password desde https://myaccount.google.com/apppasswords'
      },
      outlook: {
        name: 'Outlook/Hotmail',
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        authTypes: ['oauth2', 'password'],
        notes: 'Para password: usar App Password desde Microsoft Account Security'
      },
      yahoo: {
        name: 'Yahoo Mail',
        imapHost: 'imap.mail.yahoo.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: 465,
        smtpSecure: true,
        authTypes: ['oauth2', 'password'],
        notes: 'Requiere App Password desde https://login.yahoo.com/account/security'
      },
      custom: {
        name: 'Otro proveedor',
        notes: 'Configuración manual requerida'
      }
    };

    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    console.error('Error listando proveedores:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
