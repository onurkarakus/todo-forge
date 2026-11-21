# TodoForge 1.2.0

Daha hızlı açılır, daha çabuk düzenlenir, daha küçük iner.

## Yeni

- **Göreli son tarihler.** `TODO(…)` içinde `+7d`, `+2w`, `+1m`, `today`, `tomorrow` ya da bir gün adı (`monday` … `sunday`) yazıp öneriyi seçin: yoruma gerçek ISO tarih yazılır. `TODO(me, +7d)` zaten yazılıysa **+7d değerini 2026-11-28 olarak yaz** hızlı düzeltmesini (`Ctrl+.`) ya da **TodoForge: Bu Dosyadaki Göreli Son Tarihleri Dönüştür** komutunu kullanın. Yorumda sabit bir tarih kalır; haftaya da aynı anlama gelir.
- **Ağaçta toplu işlemler.** `Ctrl`/`Shift` ile birden fazla TODO seçin; hepsini tek seferde erteleyin, son tarih ya da öncelik verin, kendinize ya da **Sahip Ata…** ile başkasına atayın, sabitleyin, sabitlemeyi kaldırın veya sessize alın. Dosyalardaki değişiklikler tek adımda geri alınır.
- **Yeniden açılışta anında dolan ağaç.** Son tarama, VS Code'un bu çalışma alanına ait depolamasında tutulur ve pencere açılır açılmaz gösterilir; yeni tarama arka planda çalışır. Taranan içeriği değiştiren ayarlar temiz bir taramayla başlar.

## Daha hızlı

- Bir dosya değişince ağaçta yalnızca değişen satırlar yenilenir; seçim ve kaydırma konumu yerinde kalır.
- Çok köklü çalışma alanlarında en fazla üç klasör aynı anda taranır.
- Dosya izleme her çalışma alanı klasörüyle sınırlıdır; yalnızca açık dosyalar ya da bu dosya taranırken kapalıdır.
- Marketplace ve Open VSX artık platformunuza özel, yalnızca kendi ripgrep dosyasını içeren bir paket sunar: yaklaşık 15 MB yerine 2–3 MB.

## Düzeltildi

- Bir dosya silinmeden ya da kapatılmadan hemen önce yapılan bir düzenleme, TODO'larını bir sonraki tam taramaya kadar geri getirebiliyordu.

Her zamanki gibi çevrimdışı, hesap yok, telemetri yok.
