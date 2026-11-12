# Mağaza metinleri – Türkçe

VS Code, Türkçe kullanıcılara ad ve kısa açıklamayı `package.nls.tr.json` dosyasından gösterir. Marketplace ve Open VSX web sayfaları İngilizce README'yi gösterir; aşağıdaki uzun metin blog, LinkedIn, topluluk duyuruları ve ileride bir `README.tr.md` için hazırdır.

## Görünen ad

```
TodoForge – TODO Ağacı, Vurgular ve Son Tarihler
```

## Kısa açıklama

```
Hızlı ve çevrimdışı TODO/FIXME ağacı: temaya uyan vurgular, sahip ve son tarih, hızlı düzeltmeler, dalınız için Değişiklikler görünümü ve birinci sınıf .NET desteği. Hesap yok, telemetri yok.
```

Daha kısa sürüm:

```
Koddaki tüm TODO'lar tek ağaçta: sahip, son tarih ve dalınız için Değişiklikler görünümü. Çevrimdışı, hesap gerektirmez.
```

## Anahtar kelimeler

Mağaza aramaları İngilizce yapıldığı için `package.json` içindeki 30 İngilizce anahtar kelime kullanılır. Türkçe duyurularda şu etiketler işe yarar: `#vscode #todo #dotnet #csharp #gelistirici #verimlilik`.

## Uzun açıklama

> **TodoForge**, çalışma alanınızdaki tüm TODO, FIXME, HACK ve BUG yorumlarını bulur, tek bir ağaçta toplar ve editörde temanıza uyan renklerle vurgular.
>
> `TODO(onur, 2026-12-01, !high, #perf): bunu önbelleğe al` yazdığınızda TODO'nun bir sahibi, tarihi geçince kırmızıya dönen bir son tarihi, bir önceliği ve bir etiketi olur. Üzerine geldiğinizde kimin ne zaman yazdığını görürsünüz; Ctrl+. ile erteleyebilir, tarih verebilir ya da silebilirsiniz.
>
> **Değişiklikler** görünümü, henüz commit etmediğiniz ve dalınızda eklediğiniz TODO'ları yerel git'ten okuyarak listeler; böylece bir TODO farkında olmadan pull request'e girmez. Canlı filtre (`is:mine`, `is:overdue`, `@ayse`, `#perf`), sabitleme, kayıtlı görünümler ve İçgörüler paneli listeyi kısa tutmanıza yardım eder.
>
> TodoForge büyük .NET ve web depoları için tasarlandı: `bin/`, `obj/`, `node_modules/` ve üretilmiş dosyaları kutudan çıktığı gibi atlar, 70'ten fazla dosya türünde gerçek yorumları okur, C#'ta `NotImplementedException`, `[Obsolete]` ve `#warning` satırlarını da listeler. 20.000 dosyalık bir deponun tam taraması yaklaşık 50 ms sürer.
>
> Gizlilik baştan tasarımda: ağ isteği yok, telemetri yok, hesap yok. Yapay zekâ desteği isteğe bağlıdır ve VS Code'da zaten kullandığınız bir modeli kullanır.
>
> Copilot Chat mi kullanıyorsunuz? “Geciken TODO'larımdan hangileri bende?” ya da “Bu dalda hangi TODO'ları ekledim?” diye sorun: `todoforge.ai.chatTools` ayarını açtığınızda TodoForge yerel dizininden salt okunur sohbet araçlarıyla (`#todos`, `#todoChanges`, `#todo`) yanıt verir. Varsayılan olarak kapalıdır.
>
> Todo Tree, Better Todo Tree, Better Comments, Rider ya da Visual Studio'dan mı geliyorsunuz? Tek komutla etiketlerinizi ve işaretlerinizi içe aktarın.

## Öne çıkanlar

- TODO, FIXME, HACK, BUG, XXX, UNDONE, NOTE, REVIEW, OPTIMIZE ve kendi etiketleriniz için tek ağaç
- Yorumun içinde sahip, son tarih, öncelik ve etiket
- Git blame bilgili açılır kart; tek tıkla Ertele, Son tarih, Öncelik
- Hızlı düzeltmeler ve yeni TODO için kod parçacığı
- Değişiklikler görünümü: commit edilmemiş ve bu dalda eklenen TODO'lar
- Canlı filtre, sabitleme, sessize alma, kayıtlı görünümler, Benim TODO'larım
- İçgörüler paneli: etikete, klasöre, sahibe ve yaşa göre; gecikenler ve en eskiler
- Açık temada erişilebilir kontrastlı tema renkleri
- .NET uyumlu: derleme çıktısını atlar, NotImplementedException ve [Obsolete] satırlarını bulur
- Todo Tree, Better Todo Tree, Better Comments, Rider veya Visual Studio'dan içe aktarma
- Better Comments tarzı işaretler (`// !`, `// ?`, `// *`, `////`) editörde
- Tıklanabilir bilet bağlantıları, yalnızca bu dosya düğmesi, görünümü Markdown liste olarak kopyalama
- Copilot Chat araçları: #todos, #todoChanges ve #todo ile TODO'larınızı sorun (salt okunur, isteğe bağlı)
- Türkçe ve İngilizce arayüz
- Çevrimdışı, telemetri yok, hesap yok

## Ekran görüntüsü açıklamaları

| Dosya | Açıklama |
| --- | --- |
| `demo.mp4` / `demo.gif` | Sahibi, tarihi ve önceliği olan bir TODO yazın; ağaçta son tarih ipucuyla görünür; hızlı düzeltmeyle erteleyin. |
| `01-overview-dark.png` | Etikete göre gruplanmış TODO ağacı, vurgular, satır sonu ipucu, durum çubuğu sayacı. |
| `07-overview-light.png` | Açık tema: gecikmiş bir HACK, bir BUG ve NotImplementedException. |
| `02-hover-dark.png` | Açılır kart: sahip, son tarih, öncelik, etiket, git blame, eylemler. |
| `03-quick-fix-dark.png` | Hızlı düzeltmeler: ertele, son tarih, öncelik, sil, sabitle, sessize al. |
| `04-changes-dark.png` | Değişiklikler: commit edilmemiş ve bu dalda eklenen TODO'lar. |
| `05-live-filter-dark.png` | `is:mine` ile canlı filtre. |
| `06-insights-dark.png` | İçgörüler: sayılar, git blame'e göre yaş, gecikenler ve en eskiler. |
| `09-walkthrough-light.png` | Başlarken rehberi. |
| `08-snippet-light.png` | Yorum içinde kod parçacığı önerisi. |

## Sosyal medya duyurusu

```
TodoForge 1.0 VS Code için yayında: koddaki tüm TODO'lar tek ağaçta; sahip, son tarih ve dalınız için Değişiklikler görünümü. Git blame için üzerine gelin, ertelemek için Ctrl+. Büyük .NET depolarında hızlı. Çevrimdışı, hesap yok, telemetri yok.
```
