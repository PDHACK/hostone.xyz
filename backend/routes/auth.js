/**
 * Rutas de Autenticación
 * Maneja registro, login, logout y OAuth2
 */

const express = require('express');
const router = express.Router();
const encryptionService = require('../services/encryptionService');
const oauth2Service = require('../services/oauth2Service');
const db = require('../config/database');

/**
 * @route   POST /api/auth/register
 * @desc    Registra un nuevo usuario
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await db.user.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }

    // Hashear contraseña
    const hashedPassword = await encryptionService.hashPassword(password);

    // Crear usuario
    const user = await db.user.create({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0]
    });

    // Crear sesión
    req.session.userId = user.id;

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      message: 'Usuario registrado exitosamente'
    });
  } catch (error) {
    console.error('Error registrando usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Autentica un usuario
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const user = await db.user.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isValidPassword = await encryptionService.verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Crear sesión
    req.session.userId = user.id;
    req.session.save();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      message: 'Login exitoso'
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Cierra la sesión del usuario
 * @access  Private
 */
router.post('/logout', async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({
          success: false,
          error: 'Error al cerrar sesión'
        });
      }
      
      res.clearCookie('emailClientSession');
      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Obtiene información del usuario actual
 * @access  Private
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    const user = await db.user.findById(req.session.userId);
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @route   GET /api/auth/google
 * @desc    Inicia flujo OAuth2 de Google
 * @access  Public
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = oauth2Service.getGoogleAuthUrl();
    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    console.error('Error generando URL de Google:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth2 de Google no configurado'
    });
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Callback de OAuth2 de Google
 * @access  Public
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorización no proporcionado'
      });
    }

    // Intercambiar código por tokens
    const tokens = await oauth2Service.getGoogleTokens(code);

    // Buscar o crear usuario
    let user = await db.user.findByEmail(tokens.email);
    
    if (!user) {
      user = await db.user.create({
        email: tokens.email,
        name: tokens.name,
        password: await encryptionService.hashPassword(Math.random().toString(36)) // Password aleatorio
      });
    }

    // Crear sesión
    req.session.userId = user.id;

    // En producción, redirigir al frontend
    if (process.env.NODE_ENV === 'production') {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}?auth=success`);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiryDate: tokens.expiryDate
        }
      }
    });
  } catch (error) {
    console.error('Error en callback de Google:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/outlook
 * @desc    Inicia flujo OAuth2 de Outlook
 * @access  Public
 */
router.get('/outlook', (req, res) => {
  try {
    const authUrl = oauth2Service.getOutlookAuthUrl();
    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    console.error('Error generando URL de Outlook:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth2 de Outlook no configurado'
    });
  }
});

/**
 * @route   GET /api/auth/outlook/callback
 * @desc    Callback de OAuth2 de Outlook
 * @access  Public
 */
router.get('/outlook/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorización no proporcionado'
      });
    }

    // Intercambiar código por tokens
    const tokens = await oauth2Service.getOutlookTokens(code);

    // Buscar o crear usuario
    let user = await db.user.findByEmail(tokens.email);
    
    if (!user) {
      user = await db.user.create({
        email: tokens.email,
        name: tokens.name,
        password: await encryptionService.hashPassword(Math.random().toString(36))
      });
    }

    // Crear sesión
    req.session.userId = user.id;

    // En producción, redirigir al frontend
    if (process.env.NODE_ENV === 'production') {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}?auth=success`);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiryDate: tokens.expiryDate
        }
      }
    });
  } catch (error) {
    console.error('Error en callback de Outlook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
