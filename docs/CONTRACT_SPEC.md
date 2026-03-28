# 📜 Smart Contract Spesifikasyonu

## Kontrat Adresi (Testnet): `[DEPLOY_SONRASI_BURAYA_YAZ]`

### Veri Yapıları
- `struct Table { address host; uint256 total; address[] users; address loser; bool isDone; }`

### Kritik Fonksiyonlar
- `createTable(uint256 _amount)`: Yeni masa oluşturur, `tableId` döner.
- `joinTable(uint256 _id)`: Kullanıcıyı diziye ekler.
- `selectLoser(uint256 _id)`: 
  - **Logic:** `keccak256(abi.encodePacked(block.prevrandao, block.timestamp, _id)) % users.length`
- `settlePayment(...)`: 
  - `token.permit(...)` ile yetkiyi onayla.
  - `token.transferFrom(...)` ile parayı çek.

### On-Chain Güvenlik
- Rastgelelik tamamen blok verilerine dayalıdır, dış müdahaleye kapalıdır.