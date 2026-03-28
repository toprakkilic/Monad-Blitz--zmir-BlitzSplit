# 🖥️ Backend API & Relayer Dokümantasyonu

## Veri Yönetimi (In-Memory)
MVP süresince veriler RAM üzerinde tutulacaktır. Restart durumunda masalar kaybolur.

## Endpoints
- `POST /api/tables`: 5 haneli kod -> `tableId` eşleşmesini oluştur.
- `POST /api/signatures`: Kullanıcının attığı Permit imzasını (`v, r, s, deadline`) kaydet.
- `GET /api/signatures/:tableId/:address`: Belirli bir kullanıcının imzasını getir.

## Event Listening
- Web3 provider kullanarak kontrattaki `LoserSelected` event'ini dinle.
- Event tetiklendiğinde frontend'e (Socket veya Polling ile) haber ver.