# Email Client Web Application

## Arquitectura del Proyecto

```
/workspace
├── backend/
│   ├── config/
│   │   └── database.js          # Configuración de base de datos
│   ├── controllers/
│   │   ├── authController.js    # Autenticación y gestión de sesiones
│   │   ├── emailController.js   # Operaciones de correo (listar, leer, enviar)
│   │   └── accountController.js # Gestión de cuentas IMAP/SMTP
│   ├── middleware/
│   │   ├── auth.js              # Middleware de autenticación
│   │   └── validation.js        # Validación de datos de entrada
│   ├── models/
│   │   ├── User.js              # Modelo de usuario
│   │   └── EmailAccount.js      # Modelo de cuenta de correo
│   ├── routes/
│   │   ├── auth.js              # Rutas de autenticación
│   │   ├── emails.js            # Rutas de correos
│   │   └── accounts.js          # Rutas de cuentas
│   ├── services/
│   │   ├── emailService.js      # Lógica de IMAP/SMTP con nodemailer e imap
│   │   ├── encryptionService.js # Encriptación de credenciales
│   │   └── oauth2Service.js     # Gestión de OAuth2 para Gmail/Outlook
│   ├── utils/
│   │   └── mailParser.js        # Parseo de emails MIME con mailparser
│   └── server.js                # Punto de entrada principal
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── components/
│       │   ├── EmailList.jsx
│       │   ├── EmailViewer.jsx
│       │   ├── ComposeEmail.jsx
│       │   └── AccountConfig.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Inbox.jsx
│       │   └── Settings.jsx
│       ├── services/
│       │   └── api.js           # Cliente API Axios
│       ├── store/
│       │   └── authStore.js     # Estado de autenticación
│       └── styles/
│           └── tailwind.css
└── README.md
```

## Características Principales

### Seguridad (OWASP Compliance)
- Credenciales encriptadas con AES-256-GCM
- Sesiones con HTTP-only cookies (express-session + Redis)
- Protección CSRF implementada
- Validación de entrada en todos los endpoints
- Rate limiting para prevenir brute force

### Protocolos Soportados
- IMAP para recepción de correos
- SMTP para envío de correos
- OAuth2 para Gmail y Outlook (recomendado)
- Autenticación básica con App Passwords

### Parseo de Emails
- Uso de mailparser para formato MIME
- Soporte para HTML, texto plano y adjuntos
- Decodificación de charset múltiple
