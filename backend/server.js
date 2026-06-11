/**
 * Server Principal - Email Client Web Application
 * 
 * Backend para cliente de correo electrónico con soporte IMAP/SMTP
 * Implementa seguridad OWASP, encriptación de credenciales y OAuth2
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');
const accountRoutes = require('./routes/accounts');

// Importar servicio de email para cleanup
const emailService = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SEGURIDAD - Middlewares
// ============================================

// Helmet para headers de seguridad HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configurado
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting para prevenir brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: {
    success: false,
    error: 'Demasiadas peticiones, intenta más tarde'
  }
});
app.use('/api/', limiter);

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // solo 5 intentos de login
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación'
  }
});
app.use('/api/auth/', authLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// GESTIÓN DE SESIONES
// ============================================

// Configuración de sesión segura
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'cambia-esta-clave-secreta-en-produccion',
  name: 'emailClientSession', // Nombre personalizado de cookie
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // No accesible desde JavaScript (previene XSS)
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    sameSite: 'lax', // Protección CSRF
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 horas
  },
  store: null // Se puede configurar Redis aquí para producción
};

// Configurar Redis store si está disponible (para producción)
if (process.env.REDIS_HOST) {
  const RedisStore = require('connect-redis').default;
  const { createClient } = require('redis');
  
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined
  });
  
  redisClient.connect().catch(console.error);
  sessionConfig.store = new RedisStore({ client: redisClient });
}

app.use(session(sessionConfig));

// ============================================
// RUTAS API
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email Client API is running',
    timestamp: new Date().toISOString()
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de cuentas de email
app.use('/api/accounts', accountRoutes);

// Rutas de emails
app.use('/api/emails', emailRoutes);

// ============================================
// SERVICIO DEL FRONTEND (en producción)
// ============================================

if (process.env.NODE_ENV === 'production') {
  // Servir archivos estáticos del frontend
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Para SPA, todas las rutas no-API deben servir index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// ============================================
// MANEJO DE ERRORES GLOBAL
// ============================================

// Error 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Recurso no encontrado'
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  
  // No exponer detalles de error en producción
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message;
  
  res.status(err.status || 500).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ============================================
// CLEANUP AL CERRAR EL SERVIDOR
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  
  try {
    // Cerrar todas las conexiones IMAP
    await emailService.closeAllConnections();
    console.log('Conexiones IMAP cerradas');
    
    // Cerrar servidor HTTP
    server.close(() => {
      console.log('Servidor HTTP cerrado');
      process.exit(0);
    });
    
    // Timeout forzado si no cierra en 10 segundos
    setTimeout(() => {
      console.error('Forzando cierre del servidor...');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error en shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// INICIAR SERVIDOR
// ============================================

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           EMAIL CLIENT WEB APPLICATION                    ║
╠═══════════════════════════════════════════════════════════╣
║  Servidor corriendo en: http://localhost:${PORT}            ║
║  Entorno: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
║  Endpoints principales:                                   ║
║  - GET  /api/health          - Health check               ║
║  - POST /api/auth/register   - Registro de usuario        ║
║  - POST /api/auth/login      - Login                      ║
║  - POST /api/auth/logout     - Logout                     ║
║  - GET  /api/accounts        - Listar cuentas             ║
║  - POST /api/accounts        - Crear cuenta               ║
║  - GET  /api/emails/:id      - Listar emails              ║
║  - GET  /api/emails/:id/:uid - Ver email                  ║
║  - POST /api/emails/:id/send - Enviar email               ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
