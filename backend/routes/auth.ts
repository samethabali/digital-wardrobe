import express from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../db.js';
import {
  authenticateToken, byIp, byIpAndEmail, byUser, publicUser, rateLimit, RATE_LIMITS, sendError, signToken,
} from '../http.js';
import { applyConsentChange, deleteUserAccount, parseConsentChange, toConsentsDTO } from '../account.js';
import { NOTICE_VERSION } from '../../shared/privacy.js';

export function authRoutes(): express.Router {
  const router = express.Router();

  router.post('/api/auth/register', rateLimit('register', RATE_LIMITS.register, byIp), async (req, res) => {
    try {
      let { email, password, name, username } = req.body || {};
      if (!email || !password || !name || !username) {
        return res.status(400).json({ error: 'Lütfen tüm alanları doldurun.' });
      }

      // Mobil klavye/otomatik düzeltme kaynaklı görünmez boşlukların ve karakterlerin temizliği
      email = String(email).trim().toLowerCase();
      password = String(password).trim();
      name = String(name).trim().slice(0, 100);
      const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '').slice(0, 40);

      if (!email || !password || !name || !cleanUsername) {
        return res.status(400).json({ error: 'Lütfen tüm alanları geçerli değerlerle doldurun.' });
      }
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
      }

      if (await UserModel.findOne({ email } as any)) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
      }
      if (await UserModel.findOne({ username: cleanUsername } as any)) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = new UserModel({ email, username: cleanUsername, passwordHash, name, createdAt: new Date() });
      await newUser.save();

      res.json({ success: true, token: signToken(newUser), user: publicUser(newUser) });
    } catch (err) {
      sendError(res, err, 'Kayıt işlemi başarısız oldu.', 'Register');
    }
  });

  router.post('/api/auth/login', rateLimit('login', RATE_LIMITS.login, byIpAndEmail), async (req, res) => {
    try {
      let { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
      }
      email = String(email).trim().toLowerCase();
      password = String(password).trim();
      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre boş bırakılamaz.' });
      }

      const user: any = await UserModel.findOne({ email } as any);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
      }
      res.json({ success: true, token: signToken(user), user: publicUser(user) });
    } catch (err) {
      sendError(res, err, 'Giriş işlemi başarısız oldu.', 'Login');
    }
  });

  router.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await UserModel.findOne({ _id: req.user.id } as any);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      res.json({ user: publicUser(user), consents: toConsentsDTO(user), noticeVersion: NOTICE_VERSION });
    } catch (err) {
      sendError(res, err, 'Sunucu hatası.', 'Me');
    }
  });

  router.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const { email, username, name, password, isPrivate } = req.body || {};
      const user: any = await UserModel.findOne({ _id: req.user.id } as any);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

      if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== user.email) {
        const cleanEmail = email.trim().toLowerCase();
        if (await UserModel.findOne({ email: cleanEmail } as any)) return res.status(400).json({ error: 'Bu e-posta zaten kullanımda.' });
        user.email = cleanEmail;
      }

      if (typeof username === 'string' && username.trim() && username.trim().toLowerCase() !== user.username) {
        const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '').slice(0, 40);
        if (cleanUsername.length < 3) return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
        if (await UserModel.findOne({ username: cleanUsername } as any)) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        user.username = cleanUsername;
      }

      if (typeof name === 'string' && name.trim()) user.name = name.trim().slice(0, 100);

      if (password) {
        if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        user.passwordHash = await bcrypt.hash(password, 10);
      }

      if (typeof isPrivate === 'boolean') user.isPrivate = isPrivate;

      await user.save();
      res.json({ success: true, token: signToken(user), user: publicUser(user) });
    } catch (err) {
      sendError(res, err, 'Profil güncellenemedi.', 'Profile Update');
    }
  });

  router.delete('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const result = await deleteUserAccount(req.user.id);
      console.log(`[Account Delete] Hesap ve tüm veriler silindi (${result.imagesDeleted} görsel, ${result.imagesFailed} silinemedi).`);
      res.json({ success: true, message: 'Hesabınız ve tüm verileriniz başarıyla silindi.' });
    } catch (err) {
      sendError(res, err, 'Hesap silme işlemi başarısız oldu.', 'Account Delete');
    }
  });

  // ─── KVKK: rızalar ───────────────────────────────────────────────────────
  router.get('/api/auth/consents', authenticateToken, async (req: any, res) => {
    try {
      const user = await UserModel.findOne({ _id: req.user.id } as any);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      res.json({ consents: toConsentsDTO(user), noticeVersion: NOTICE_VERSION });
    } catch (err) {
      sendError(res, err, 'Rıza ayarları alınamadı.', 'Consents');
    }
  });

  const updateConsents = async (req: any, res: express.Response) => {
    try {
      const consents = await applyConsentChange(req.user.id, parseConsentChange(req.body));
      res.json({ success: true, consents, noticeVersion: NOTICE_VERSION });
    } catch (err) {
      sendError(res, err, 'Rıza ayarları kaydedilemedi.', 'Consents');
    }
  };
  // POST eski istemciler için korunur
  router.put('/api/auth/consents', authenticateToken, rateLimit('consents', RATE_LIMITS.push, byUser), updateConsents);
  router.post('/api/auth/consents', authenticateToken, rateLimit('consents', RATE_LIMITS.push, byUser), updateConsents);

  return router;
}
