# TodoForge 1.0.0 – sürüm notları

**TodoForge 1.0, TODO yorumlarını editörden ve bilgisayarınızdan çıkmadan üzerinde işlem yapabileceğiniz işlere dönüştürüyor.**

## Öne çıkanlar

- **Sahip, son tarih, öncelik, etiket** – `TODO(onur, 2026-12-01, !high, #perf): …`. Tarihi geçen TODO'lar kırmızıya döner; yaklaşanlar satır sonunda ipucu gösterir.
- **Açılır kart ve hızlı düzeltmeler** – TODO'yu kimin ne zaman yazdığını görün (yerel git blame); erteleyin, tarih ya da öncelik verin, sabitleyin, sessize alın veya silin.
- **Değişiklikler görünümü** – commit etmediğiniz ve dalınızda eklediğiniz TODO'lar.
- **Canlı filtre ve kayıtlı görünümler** – `is:mine`, `is:overdue`, `is:new`, `is:stale`, `tag:`, `@sahip`, `#etiket`, `path:`.
- **Sabitleme ve sessize alma** – önemlileri üstte tutun, gürültüyü gizleyin.
- **İçgörüler** – etikete, klasöre ve sahibe göre sayılar, yaşlar, geciken ve en eski TODO'lar.
- Açık temada da okunaklı **tema renkleri**, yeni simge, Başlarken rehberi ve **Türkçe** arayüz.
- Todo Tree, Rider veya Visual Studio'dan **ayarları içe aktarma**.

## Varsayılanlar daha sessiz

Etiketler büyük/küçük harfe duyarlı; `NOTE`, `BUG`, `REVIEW`, `OPTIMIZE` ancak ardından `:` veya `(` gelirse sayılır. Üretilmiş ve küçültülmüş dosyalar atlanır. Sorunlar paneli ve CodeLens siz açana kadar kapalı.

## 0.1'den gelen kırıcı değişiklikler

- My Tasks (Görevlerim) yerini Sabitlenenler'e bıraktı. 0.1'deki görevler taşınmaz.
- `todoforge.tasks.*` ayarları kaldırıldı.

## Gizlilik

Ağ isteği yok, telemetri yok, hesap yok. Yapay zekâ desteği (`todoforge.ai.enabled`) varsayılan olarak kapalıdır; yalnızca onay verdikten sonra VS Code'da zaten bulunan bir sohbet modelini kullanır.

Tam liste: [CHANGELOG.md](../../CHANGELOG.md).
