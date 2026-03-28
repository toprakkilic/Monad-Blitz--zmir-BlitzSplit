# 🎨 Frontend & Web3 Entegrasyon Rehberi

## 🔐 Oturum Yönetimi
- **Giriş:** RainbowKit "Connect Wallet" ile yapılır. 
- **Session:** Kullanıcının `address` bilgisi global state (Context/Zustand) içinde tutulur.

## 📱 Sayfa Akışları
1. **Home (`/`):** Karşılama ve Cüzdan Bağlama.
2. **Dashboard:** "Masa Aç" veya "Kodla Katıl".
3. **Lobby (`/table/[id]`):** - Katılımcıları listele.
   - "Sign & Ready" butonu ile `signTypedData` (Permit) tetikle.
4. **Result:** Rulet animasyonu ve kaybeden duyurusu.

## 📝 Önemli: Permit İmza Yapısı
- Domain name: `MonadToken`
- Version: `1`
- ChainId: `10143`
- VerifyingContract: `[TOKEN_CONTRACT_ADDRESS]`