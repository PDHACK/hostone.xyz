/**
 * Middleware de Autenticación
 * Verifica que el usuario tenga una sesión válida
 */

const db = require('../config/database');

/**
 * Verifica si el usuario está autenticado
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // Verificar si existe sesión
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Inicia sesión primero.'
      });
    }

    // Verificar que el usuario exista
    const user = await db.user.findById(req.session.userId);
    
    if (!user) {
      // Usuario no encontrado, destruir sesión
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado. Inicia sesión nuevamente.'
      });
    }

    // Adjuntar usuario al request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay sesión, pero adjunta el usuario si existe
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await db.user.findById(req.session.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // No fallar, continuar sin usuario
    next();
  }
};

module.exports = {
  isAuthenticated,
  optionalAuth
};
