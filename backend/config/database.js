/**
 * Configuración de base de datos
 * Para este ejemplo usamos un almacenamiento en memoria,
 * pero en producción deberías usar MongoDB, PostgreSQL o MySQL
 */

// Store temporal en memoria (REEMPLAZAR con base de datos real en producción)
const users = new Map();
const emailAccounts = new Map();
const sessions = new Map();

module.exports = {
  // Operaciones de usuarios
  user: {
    create: async (userData) => {
      const id = require('uuid').v4();
      const user = { id, ...userData, createdAt: new Date() };
      users.set(id, user);
      return user;
    },
    findById: async (id) => users.get(id),
    findByEmail: async (email) => {
      for (const user of users.values()) {
        if (user.email === email) return user;
      }
      return null;
    },
    update: async (id, data) => {
      const user = users.get(id);
      if (user) {
        users.set(id, { ...user, ...data });
        return users.get(id);
      }
      return null;
    }
  },
  
  // Operaciones de cuentas de email
  emailAccount: {
    create: async (accountData) => {
      const id = require('uuid').v4();
      const account = { id, ...accountData, createdAt: new Date() };
      emailAccounts.set(id, account);
      return account;
    },
    findByUserId: async (userId) => {
      const accounts = [];
      for (const account of emailAccounts.values()) {
        if (account.userId === userId) accounts.push(account);
      }
      return accounts;
    },
    findById: async (id) => emailAccounts.get(id),
    update: async (id, data) => {
      const account = emailAccounts.get(id);
      if (account) {
        emailAccounts.set(id, { ...account, ...data });
        return emailAccounts.get(id);
      }
      return null;
    },
    delete: async (id) => emailAccounts.delete(id)
  }
};
