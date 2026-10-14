/**
 * Rutas de Emails
 * Define los endpoints para operaciones con correos electrónicos
 */

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { isAuthenticated } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

/**
 * @route   GET /api/emails/:accountId
 * @desc    Lista emails de una cuenta
 * @access  Private
 */
router.get('/:accountId', emailController.listEmails);

/**
 * @route   GET /api/emails/:accountId/folders
 * @desc    Lista carpetas disponibles
 * @access  Private
 */
router.get('/:accountId/folders', emailController.listFolders);

/**
 * @route   GET /api/emails/:accountId/:uid
 * @desc    Obtiene un email específico
 * @access  Private
 */
router.get('/:accountId/:uid', emailController.getEmail);

/**
 * @route   POST /api/emails/:accountId/send
 * @desc    Envía un email
 * @access  Private
 */
router.post('/:accountId/send', emailController.sendEmail);

/**
 * @route   PATCH /api/emails/:accountId/:uid/read
 * @desc    Marca un email como leído/no leído
 * @access  Private
 */
router.patch('/:accountId/:uid/read', emailController.markAsRead);

/**
 * @route   DELETE /api/emails/:accountId/:uid
 * @desc    Elimina un email
 * @access  Private
 */
router.delete('/:accountId/:uid', emailController.deleteEmail);

/**
 * @route   POST /api/emails/:accountId/:uid/move
 * @desc    Mueve un email a otra carpeta
 * @access  Private
 */
router.post('/:accountId/:uid/move', emailController.moveEmail);

module.exports = router;
