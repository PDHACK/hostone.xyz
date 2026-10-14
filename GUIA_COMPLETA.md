# Guía Completa - Email Client Web Application

## 1. Arquitectura del Proyecto

### Estructura de Archivos

```
/workspace
├── backend/
│   ├── config/
│   │   └── database.js          # Configuración DB (memoria para demo)
│   ├── controllers/
│   │   └── emailController.js   # Controlador de operaciones de email
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación
│   ├── routes/
│   │   ├── auth.js              # Rutas de autenticación
│   │   ├── accounts.js          # Rutas de cuentas
│   │   └── emails.js            # Rutas de emails
│   ├── services/
│   │   ├── emailService.js      # Lógica IMAP/SMTP
│   │   ├── encryptionService.js # Encriptación AES-256
│   │   └── oauth2Service.js     # OAuth2 para Gmail/Outlook
│   ├── server.js                # Punto de entrada principal
│   ├── package.json             # Dependencias
│   └── .env.example             # Variables de entorno
└── frontend/                    # React + Tailwind (estructura base)
```

## 2. API Endpoints Principales

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login con email/password |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Obtener usuario actual |
| GET | `/api/auth/google` | Iniciar OAuth2 Google |
| GET | `/api/auth/google/callback` | Callback Google OAuth2 |
| GET | `/api/auth/outlook` | Iniciar OAuth2 Outlook |
| GET | `/api/auth/outlook/callback` | Callback Outlook OAuth2 |

### Cuentas de Email
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/accounts` | Listar cuentas del usuario |
| POST | `/api/accounts` | Crear nueva cuenta |
| PUT | `/api/accounts/:id` | Actualizar cuenta |
| DELETE | `/api/accounts/:id` | Eliminar cuenta |
| POST | `/api/accounts/:id/test` | Probar conexión |
| GET | `/api/accounts/providers` | Lista proveedores soportados |

### Emails
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/emails/:accountId` | Listar emails (query: folder, limit) |
| GET | `/api/emails/:accountId/:uid` | Obtener email completo |
| POST | `/api/emails/:accountId/send` | Enviar email |
| PATCH | `/api/emails/:accountId/:uid/read` | Marcar como leído/no leído |
| DELETE | `/api/emails/:accountId/:uid` | Eliminar email |
| POST | `/api/emails/:accountId/:uid/move` | Mover a otra carpeta |
| GET | `/api/emails/:accountId/folders` | Listar carpetas |

## 3. Gestión de Sesiones y Tokens

### Cómo Funciona la Autenticación

1. **Sesiones HTTP-only Cookies**
   - Las credenciales NUNCA se almacenan en localStorage
   - Se usa `express-session` con cookies httpOnly
   - La cookie no es accesible desde JavaScript (previene XSS)
   - SameSite=lax protege contra CSRF

2. **Flujo de Sesión**
   ```
   Usuario login → Backend crea sesión → Cookie httpOnly al navegador
   Cada petición → Cookie enviada automáticamente → Backend valida sesión
   Logout → Backend destruye sesión → Cookie eliminada
   ```

3. **Almacenamiento de Sesiones**
   - Desarrollo: Memoria (default)
   - Producción: Redis (recomendado para escalabilidad)

4. **Tokens OAuth2**
   - Los access/refresh tokens se encriptan con AES-256
   - Se almacenan en la base de datos asociados al usuario
   - El refresh token permite obtener nuevos access tokens sin re-autenticar

## 4. Configuración de OAuth2 para Gmail

### Paso a Paso: Google Cloud Console

1. **Crear Proyecto en Google Cloud**
   - Ve a https://console.cloud.google.com/
   - Crear nuevo proyecto (ej: "Mi Email Client")

2. **Habilitar Gmail API**
   - Ir a "APIs & Services" > "Library"
   - Buscar "Gmail API" y habilitarla

3. **Crear Credenciales OAuth2**
   - Ir a "APIs & Services" > "Credentials"
   - Click en "Create Credentials" > "OAuth client ID"
   - Configurar pantalla de consentimiento (OAuth consent screen)
   - Tipo de aplicación: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`

4. **Obtener Client ID y Secret**
   - Copia el Client ID y Client Secret generados
   - Agregarlos a tu `.env`:
   ```
   GOOGLE_CLIENT_ID=tu_client_id_aqui.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```

### App Passwords (Alternativa a OAuth2)

Si prefieres usar password tradicional:

1. Activar 2FA en tu cuenta Google
2. Ir a https://myaccount.google.com/apppasswords
3. Generar un App Password para "Mail"
4. Usar ese password (16 caracteres) en lugar de tu password normal

## 5. Configuración para Outlook

### Microsoft Azure Portal

1. **Registrar Aplicación**
   - Ve a https://portal.azure.com/
   - Ir a "Azure Active Directory" > "App registrations"
   - Nueva registración
   - Redirect URI: `http://localhost:3000/auth/outlook/callback`

2. **Configurar Permisos**
   - Ir a "API permissions"
   - Agregar: IMAP.AccessAsUser.All, SMTP.Send, offline_access

3. **Crear Client Secret**
   - Ir a "Certificates & secrets"
   - Nuevo client secret
   - Copiar el valor (solo se muestra una vez)

4. **Variables de Entorno**
   ```
   OUTLOOK_CLIENT_ID=tu_client_id
   OUTLOOK_CLIENT_SECRET=tu_client_secret
   OUTLOOK_REDIRECT_URI=http://localhost:3000/auth/outlook/callback
   ```

## 6. Seguridad OWASP Implementada

### Medidas de Seguridad

| Vulnerabilidad | Protección Implementada |
|---------------|------------------------|
| XSS | Cookies httpOnly, CSP headers |
| CSRF | SameSite cookies, CSRF tokens |
| Brute Force | Rate limiting (5 intentos/login) |
| SQL Injection | Consultas parametrizadas |
| Credenciales expuestas | Encriptación AES-256-GCM |
| Session Hijacking | Secure cookies, session timeout |
| Header attacks | Helmet.js security headers |

### Encriptación de Credenciales

```javascript
// Las contraseñas y tokens se encriptan antes de guardar
const encrypted = encryptionService.encryptCredentials({
  password: 'mi_password',
  accessToken: 'token_acceso',
  refreshToken: 'token_refresh'
});

// Solo se desencriptan temporalmente para usar
const decrypted = encryptionService.decryptCredentials(encrypted);
```

## 7. Instalación y Ejecución

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm run dev
```

### Variables de Entorno (.env)

```env
PORT=3000
SESSION_SECRET=clave_secreta_muy_larga_y_segura
ENCRYPTION_KEY=clave_de_32_caracteres_para_aes256

# OAuth2 Google (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# OAuth2 Outlook (opcional)
OUTLOOK_CLIENT_ID=xxx
OUTLOOK_CLIENT_SECRET=xxx
OUTLOOK_REDIRECT_URI=http://localhost:3000/auth/outlook/callback

# Redis (producción)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 8. Ejemplo de Uso de la API

### Listar Emails

```javascript
// GET /api/emails/:accountId?folder=INBOX&limit=50
fetch('/api/emails/abc123?folder=INBOX&limit=50', {
  credentials: 'include' // Importante para enviar cookies
})
.then(res => res.json())
.then(data => console.log(data.data.emails));
```

### Enviar Email

```javascript
// POST /api/emails/:accountId/send
fetch('/api/emails/abc123/send', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'destinatario@example.com',
    subject: 'Hola desde mi app',
    text: 'Este es el cuerpo del email',
    html: '<p>Este es el cuerpo del email</p>'
  })
});
```

### Configurar Cuenta Gmail

```javascript
// POST /api/accounts
fetch('/api/accounts', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'mi@gmail.com',
    password: 'app-password-de-16-caracteres',
    provider: 'gmail',
    authType: 'password' // o 'oauth2'
  })
});
```

## 9. Parseo de Emails MIME

El sistema usa `mailparser` que:
- Decodifica automáticamente charsets (UTF-8, ISO-8859-1, etc.)
- Separa texto plano y HTML
- Extrae adjuntos con metadata
- Parsea headers complejos
- Maneja emails multipart

```javascript
// El email parseado incluye:
{
  from: '"Remitente" <remitente@example.com>',
  to: '"Destinatario" <dest@ejemplo.com>',
  subject: 'Asunto del email',
  text: 'Contenido en texto plano',
  html: '<p>Contenido en HTML</p>',
  attachments: [
    { filename: 'documento.pdf', mimeType: 'application/pdf', size: 12345 }
  ]
}
```

## 10. Consideraciones de Producción

### Checklist Pre-Producción

- [ ] Cambiar SESSION_SECRET a valor único y seguro
- [ ] Configurar ENCRYPTION_KEY de 32 caracteres
- [ ] Habilitar HTTPS (cookies secure requieren HTTPS)
- [ ] Configurar Redis para sesiones
- [ ] Ajustar rate limits según necesidad
- [ ] Configurar logs centralizados
- [ ] Setup de monitoreo y alertas
- [ ] Backup automático de base de datos
- [ ] Revisar CORS origins permitidos

### Escalabilidad

- Usar Redis cluster para sesiones distribuidas
- Implementar colas para envío de emails (Bull + Redis)
- Cache de conexiones IMAP por usuario
- Load balancer para múltiples instancias del servidor
