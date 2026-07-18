'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Cpu, Download, LockKeyhole, Play, Settings2, Sparkles, Workflow } from 'lucide-react';
import { readSettings } from '../../lib/settings';
import type { Locale } from '../../lib/i18n';

const content = {
  en: {
    back: 'Back to studio',
    badge: 'OcularMP4 wiki',
    title: 'A practical guide to private media conversion',
    intro: 'Learn how each part of OcularMP4 works, when to use each engine, and how to get reliable results from presets, AI providers, and the conversion queue.',
    toc: 'On this page',
    sections: [
      ['overview', 'Overview'],
      ['workflow', 'The four-step workflow'],
      ['engines', 'Choosing an engine'],
      ['presets', 'Presets and AI generation'],
      ['queue', 'Batch conversion queue'],
      ['privacy', 'Privacy and offline behavior'],
      ['troubleshooting', 'Troubleshooting'],
    ],
    overviewTitle: 'Overview',
    overviewBody: 'OcularMP4 is a browser-native media studio. Your imported files and generated outputs stay in browser memory while you work. The app can use a lightweight native browser engine or load FFmpeg.wasm when you need more formats and exact codec control.',
    workflowTitle: 'The four-step workflow',
    workflow: [
      ['1', 'Import', 'Choose one or more local video or audio files, or drop them onto the import area. Select a queue item to preview it and adjust its trim range.'],
      ['2', 'Preset', 'Start with a built-in profile, a saved custom preset, an imported JSON preset, or a new AI-generated configuration.'],
      ['3', 'Adjust', 'Fine-tune format, codec, resolution, frame rate, bitrate, audio, and advanced FFmpeg arguments before conversion.'],
      ['4', 'Export', 'Watch the result, download the file, or download individual completed files from the queue.'],
    ],
    enginesTitle: 'Choosing an engine',
    engines: [
      ['Native browser engine', 'Fast and lightweight for one video at a time. It produces VP9 WebM through canvas and MediaRecorder, so it does not honor every container or codec selection.'],
      ['FFmpeg.wasm', 'Best for exact output settings, MP4, MKV, GIF, audio extraction, codec control, and multi-file queues. The compiler is loaded on demand and cached when the browser allows it.'],
    ],
    presetsTitle: 'Presets and AI generation',
    presetsBody: 'Presets are reusable recipes containing safe FFmpeg arguments plus the settings shown in the Adjust step. Use tags and favorites to organize your library. Exported JSON contains custom presets only and never API keys.',
    aiSteps: ['Open Settings and choose a provider, model, endpoint, and credential.', 'Return to the Preset step and describe the desired output in plain language.', 'Review the generated settings and FFmpeg arguments before saving or converting.'],
    queueTitle: 'Batch conversion queue',
    queueBody: 'Select multiple files during Import to create a queue. FFmpeg.wasm processes jobs sequentially so the browser stays predictable and memory use remains bounded.',
    queueTips: ['Pause waits until the current file finishes, then pauses before the next file.', 'Cancel stops the queue after the current job and leaves completed downloads available.', 'Failed jobs can be retried individually; completed jobs can be downloaded or cleared.'],
    privacyTitle: 'Privacy and offline behavior',
    privacyBody: 'Local conversion does not upload media. Settings, custom presets, favorites, and AI history use device-local storage. Cloud AI sends only the prompt and temporary credential for the current request. Ollama and custom local endpoints connect directly from the browser.',
    troubleshootingTitle: 'Troubleshooting',
    troubleshooting: [
      ['The output is always WebM', 'The Native engine is selected. Load FFmpeg.wasm in Settings and select the FFmpeg engine for exact format output.'],
      ['Multiple files will not start', 'Batch processing requires FFmpeg.wasm. Load the compiler, then start the queue again.'],
      ['Ollama cannot connect', 'Allow the deployed site origin in OLLAMA_ORIGINS and confirm the Ollama endpoint is reachable from your browser.'],
      ['The browser slows down', 'Process fewer large files at once, use a smaller resolution, or pause the queue between jobs.'],
    ],
    footer: 'Need the controls now?',
    openStudio: 'Open the studio',
  },
  id: {
    back: 'Kembali ke studio',
    badge: 'Wiki OcularMP4',
    title: 'Panduan praktis konversi media privat',
    intro: 'Pelajari cara kerja setiap bagian OcularMP4, kapan memakai setiap mesin, dan cara mendapatkan hasil andal dari preset, penyedia AI, serta antrean konversi.',
    toc: 'Di halaman ini',
    sections: [
      ['overview', 'Ringkasan'],
      ['workflow', 'Alur empat langkah'],
      ['engines', 'Memilih mesin'],
      ['presets', 'Preset dan pembuatan AI'],
      ['queue', 'Antrean konversi batch'],
      ['privacy', 'Privasi dan mode offline'],
      ['troubleshooting', 'Pemecahan masalah'],
    ],
    overviewTitle: 'Ringkasan',
    overviewBody: 'OcularMP4 adalah studio media langsung di browser. File yang diimpor dan hasil yang dibuat tetap berada di memori browser selama Anda bekerja. Gunakan mesin native yang ringan atau muat FFmpeg.wasm saat membutuhkan lebih banyak format dan kontrol codec yang presisi.',
    workflowTitle: 'Alur empat langkah',
    workflow: [
      ['1', 'Impor', 'Pilih satu atau beberapa file video atau audio lokal, atau letakkan file di area impor. Pilih item antrean untuk melihat pratinjau dan mengatur rentang potong.'],
      ['2', 'Preset', 'Mulai dari profil bawaan, preset kustom tersimpan, preset JSON impor, atau konfigurasi baru yang dibuat AI.'],
      ['3', 'Sesuaikan', 'Atur format, codec, resolusi, frame rate, bitrate, audio, dan argumen FFmpeg lanjutan sebelum konversi.'],
      ['4', 'Ekspor', 'Lihat hasil, unduh file, atau unduh setiap file selesai dari antrean.'],
    ],
    enginesTitle: 'Memilih mesin',
    engines: [
      ['Mesin native browser', 'Cepat dan ringan untuk satu video. Mesin ini menghasilkan WebM VP9 melalui canvas dan MediaRecorder, sehingga tidak selalu mengikuti pilihan container atau codec.'],
      ['FFmpeg.wasm', 'Terbaik untuk pengaturan output presisi, MP4, MKV, GIF, ekstraksi audio, kontrol codec, dan antrean multi-file. Compiler dimuat sesuai kebutuhan dan dapat disimpan browser.'],
    ],
    presetsTitle: 'Preset dan pembuatan AI',
    presetsBody: 'Preset adalah resep yang dapat digunakan ulang, berisi argumen FFmpeg aman dan pengaturan di langkah Sesuaikan. Gunakan tag dan favorit untuk mengatur koleksi. JSON ekspor hanya berisi preset kustom dan tidak pernah berisi kunci API.',
    aiSteps: ['Buka Pengaturan lalu pilih penyedia, model, endpoint, dan kredensial.', 'Kembali ke langkah Preset dan jelaskan hasil yang Anda inginkan dengan bahasa biasa.', 'Periksa pengaturan dan argumen FFmpeg dari AI sebelum menyimpan atau mengonversi.'],
    queueTitle: 'Antrean konversi batch',
    queueBody: 'Pilih beberapa file saat Impor untuk membuat antrean. FFmpeg.wasm memproses pekerjaan secara berurutan agar browser tetap stabil dan penggunaan memori lebih terkendali.',
    queueTips: ['Jeda menunggu file saat ini selesai, lalu berhenti sebelum file berikutnya.', 'Batalkan menghentikan antrean setelah pekerjaan saat ini dan tetap mempertahankan hasil yang sudah selesai.', 'Pekerjaan gagal dapat dicoba ulang; pekerjaan selesai dapat diunduh atau dihapus.'],
    privacyTitle: 'Privasi dan mode offline',
    privacyBody: 'Konversi lokal tidak mengunggah media. Pengaturan, preset kustom, favorit, dan riwayat AI menggunakan penyimpanan lokal perangkat. AI cloud hanya menerima prompt dan kredensial sementara untuk permintaan saat ini. Ollama dan endpoint lokal terhubung langsung dari browser.',
    troubleshootingTitle: 'Pemecahan masalah',
    troubleshooting: [
      ['Hasil selalu WebM', 'Mesin Native sedang dipilih. Muat FFmpeg.wasm di Pengaturan dan pilih mesin FFmpeg untuk format output yang presisi.'],
      ['Beberapa file tidak mulai', 'Pemrosesan batch membutuhkan FFmpeg.wasm. Muat compiler lalu mulai antrean lagi.'],
      ['Ollama tidak terhubung', 'Izinkan origin situs di OLLAMA_ORIGINS dan pastikan endpoint Ollama dapat dijangkau dari browser.'],
      ['Browser melambat', 'Proses lebih sedikit file besar, gunakan resolusi lebih kecil, atau jeda antrean di antara pekerjaan.'],
    ],
    footer: 'Butuh memakai kontrolnya sekarang?',
    openStudio: 'Buka studio',
  },
} as const;

export default function GuidePage() {
  const [locale, setLocale] = useState<Locale>('en');
  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(readSettings().locale), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const copy = content[locale];
  return (
    <main className="min-h-screen bg-[#0b1020] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1020]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-mark.svg" alt="OcularMP4" width={38} height={38} className="rounded-xl" />
            <span className="font-semibold tracking-tight">OcularMP4 <span className="font-normal text-slate-500">/ Wiki</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">{(['en', 'id'] as Locale[]).map((item) => <button key={item} onClick={() => setLocale(item)} className={`rounded-md px-2 py-1 text-xs font-semibold ${locale === item ? 'bg-cyan-300 text-[#0b1020]' : 'text-slate-400'}`}>{item.toUpperCase()}</button>)}</div>
            <Link href="/" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" />{copy.back}</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">{copy.badge}</div>
          <nav className="space-y-1 rounded-2xl border border-white/10 bg-[#111a30] p-3">
            <div className="mb-3 px-3 text-xs font-semibold text-slate-400">{copy.toc}</div>
            {copy.sections.map(([id, label], index) => <a key={id} href={`#${id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span className="text-xs text-slate-600">{String(index + 1).padStart(2, '0')}</span>{label}<ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-600" /></a>)}
          </nav>
        </aside>
        <article className="min-w-0 max-w-4xl">
          <div className="mb-12 border-b border-white/10 pb-10"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"><BookOpen className="h-3.5 w-3.5" />{copy.badge}</div><h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-400">{copy.intro}</p></div>
          <GuideSection id="overview" title={copy.overviewTitle} icon={BookOpen}><p>{copy.overviewBody}</p></GuideSection>
          <GuideSection id="workflow" title={copy.workflowTitle} icon={Workflow}><div className="grid gap-3 sm:grid-cols-2">{copy.workflow.map(([number, title, body]) => <div key={number} className="rounded-2xl border border-white/10 bg-[#111a30] p-5"><div className="mb-4 grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-sm font-bold text-cyan-200">{number}</div><h3 className="mb-2 font-semibold text-white">{title}</h3><p>{body}</p></div>)}</div></GuideSection>
          <GuideSection id="engines" title={copy.enginesTitle} icon={Cpu}><div className="grid gap-4 sm:grid-cols-2">{copy.engines.map(([title, body]) => <div key={title} className="rounded-2xl border border-white/10 bg-[#111a30] p-5"><h3 className="mb-2 font-semibold text-white">{title}</h3><p>{body}</p></div>)}</div></GuideSection>
          <GuideSection id="presets" title={copy.presetsTitle} icon={Sparkles}><p>{copy.presetsBody}</p><ol className="mt-5 space-y-3">{copy.aiSteps.map((item, index) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /><span>{index + 1}. {item}</span></li>)}</ol></GuideSection>
          <GuideSection id="queue" title={copy.queueTitle} icon={Download}><p>{copy.queueBody}</p><ul className="mt-5 space-y-3">{copy.queueTips.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" /><span>{item}</span></li>)}</ul></GuideSection>
          <GuideSection id="privacy" title={copy.privacyTitle} icon={LockKeyhole}><p>{copy.privacyBody}</p></GuideSection>
          <GuideSection id="troubleshooting" title={copy.troubleshootingTitle} icon={Settings2}><div className="space-y-3">{copy.troubleshooting.map(([title, body]) => <details key={title} className="group rounded-2xl border border-white/10 bg-[#111a30] p-4"><summary className="cursor-pointer list-none font-medium text-white">{title}<ChevronRight className="float-right h-4 w-4 text-slate-500 transition group-open:rotate-90" /></summary><p className="pt-3">{body}</p></details>)}</div></GuideSection>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-6 sm:flex-row sm:items-center"><div><p className="text-sm text-slate-300">{copy.footer}</p></div><Link href="/" className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#0b1020]"><Play className="mr-2 inline h-4 w-4" />{copy.openStudio}</Link></div>
        </article>
      </div>
    </main>
  );
}

function GuideSection({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28 border-b border-white/10 py-10 first:pt-0"><div className="mb-5 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Icon className="h-4 w-4" /></div><h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2></div><div className="space-y-4 text-sm leading-7 text-slate-400">{children}</div></section>;
}
