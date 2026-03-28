import hre from "hardhat";

async function main() {
  console.log("🚀 Monad Testnet ağına deploy işlemi başlatılıyor...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  
  if (!deployer) {
    console.error("❌ Hata: Geçerli bir cüzdan bulunamadı! Lütfen .env dosyanı kontrol et.");
    process.exit(1);
  }

  console.log("👤 Deploy yapan hesap:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💎 Mevcut Bakiye:", hre.ethers.formatEther(balance), "MON\n");

  if (balance === 0n) {
      console.warn("⚠️ DİKKAT: Cüzdanınızda hiç test MON bulunmuyor.");
      console.warn("Deploy işlemi sırasında gas yetersizliği sebebiyle hata alabilirsiniz.");
      console.warn("Lütfen Monad testnet faucet üzerinden cüzdanınıza test tokeni isteyin.\n");
  }

  // Deploy MockUSDC
  console.log("⏳ MockUSDC yükleniyor...");
  const mockUSDC = await hre.ethers.deployContract("MockUSDC");
  await mockUSDC.waitForDeployment();
  const mockUsdcAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC yüklendi: ", mockUsdcAddress);

  // Deploy MonadSplitter using MockUSDC address
  console.log("\n⏳ MonadSplitter yükleniyor...");
  const splitter = await hre.ethers.deployContract("MonadSplitter", [mockUsdcAddress]);
  await splitter.waitForDeployment();
  const splitterAddress = await splitter.getAddress();
  console.log("✅ MonadSplitter yüklendi: ", splitterAddress);

  console.log("\n========================================================");
  console.log("🎉 DEPLOYMENT ÖZETİ 🎉");
  console.log("========================================================");
  console.log("MOCK_USDC_ADDRESS = '" + mockUsdcAddress + "';");
  console.log("MONAD_SPLITTER_ADDRESS = '" + splitterAddress + "';");
  console.log("========================================================");
  console.log("\n⚠️ ÖNEMLİ ADIM:");
  console.log("Lütfen bu 2 adresi sırasıyla kopyalayıp, projedeki");
  console.log("frontend/src/config/abi.ts içerisindeki eski adreslerle GÜNCELLEYİN.");
}

main().catch((error) => {
  console.error("\n❌ İşlem sırasında bir hata oluştu:");
  console.error(error);
  process.exitCode = 1;
});
