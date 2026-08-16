// 勉強管理帳ウィジェット（Scriptable用）
// ホーム画面に 試験カウントダウン / 今週の実績 / 今日の予定 を表示します。
//
// 使い方:
//   1. 勉強管理帳アプリの 設定 → 「ウィジェット用データをコピー」
//   2. Scriptableでこのスクリプトを実行（クリップボードから取り込み）
//   3. ホーム画面にScriptableウィジェットを追加し、Scriptにこれを指定
//
// ウィジェット内で実行された場合は保存済みデータを表示し、
// アプリ内で実行された場合はクリップボードからデータを取り込みます。

const FILE = "study-widget.json";
const fm = FileManager.local();
const dataPath = fm.joinPath(fm.documentsDirectory(), FILE);

function pad(n){ return (n < 10 ? "0" : "") + n; }
function todayStr(){ const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
function daysTo(dstr){
  if (!dstr) return null;
  const p = dstr.split("-");
  const target = new Date(+p[0], +p[1]-1, +p[2]);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - t0) / 86400000);
}
function fmtH(min){ return (min/60).toFixed(1) + "h"; }
function loadData(){
  if (!fm.fileExists(dataPath)) return null;
  try { return JSON.parse(fm.readString(dataPath)); } catch(e){ return null; }
}

if (config.runsInWidget) {
  const w = makeWidget(loadData());
  Script.setWidget(w);
  Script.complete();
} else {
  await importFromClipboard();
  Script.complete();
}

async function importFromClipboard(){
  const txt = Pasteboard.paste();
  const a = new Alert();
  let ok = false;
  try {
    const d = JSON.parse(txt);
    if (d && d.v === 1 && d.weekStart) {
      fm.writeString(dataPath, JSON.stringify(d));
      ok = true;
    }
  } catch(e){}
  if (ok) {
    a.title = "取り込み完了 ✅";
    a.message = "ウィジェットに反映されます。\nホーム画面にウィジェットを追加していない場合は、ホーム画面長押し → ＋ → Scriptable から追加してください。";
  } else {
    a.title = "データが見つかりません";
    a.message = "先に勉強管理帳アプリの 設定 → 「ウィジェット用データをコピー」を押してから、もう一度実行してください。";
  }
  a.addAction("OK");
  await a.present();
}

function makeWidget(d){
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#F5F7F6"), new Color("#101513"));
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  w.setPadding(14, 14, 14, 14);

  const ink    = Color.dynamic(new Color("#1B2420"), new Color("#E6ECE8"));
  const ink2   = Color.dynamic(new Color("#4A5A52"), new Color("#A8B5AE"));
  const green  = Color.dynamic(new Color("#1D8A56"), new Color("#35A873"));
  const indigo = Color.dynamic(new Color("#4756B8"), new Color("#6478DE"));
  const amber  = Color.dynamic(new Color("#B7791F"), new Color("#B5831F"));

  if (!d) {
    const t = w.addText("勉強管理帳");
    t.font = Font.boldSystemFont(14); t.textColor = ink;
    w.addSpacer(6);
    const m = w.addText("アプリの設定→「ウィジェット用データをコピー」→ Scriptableでこのスクリプトを一度実行してください");
    m.font = Font.systemFont(11); m.textColor = ink2;
    return w;
  }

  const small = (config.widgetFamily === "small");
  const large = (config.widgetFamily === "large");
  const today = todayStr();

  // 試験カウントダウン
  const head = w.addStack();
  head.layoutHorizontally();
  addCount(head, "簿記1級", daysTo(d.bokiDate), green, ink2, small);
  head.addSpacer(small ? 10 : 18);
  addCount(head, "短答式", daysTo(d.cpaDate), indigo, ink2, small);
  head.addSpacer();
  w.addSpacer(small ? 6 : 10);

  // 今週の実績と連続日数
  const actual = (d.weekActual || []).reduce((a, b) => a + b, 0);
  const goalMin = (d.goalHours || 25) * 60;
  const pct = Math.min(100, Math.round(actual / goalMin * 100));
  const line = w.addStack();
  line.layoutHorizontally();
  line.centerAlignContent();
  const p1 = line.addText("今週 " + fmtH(actual) + " / " + (d.goalHours || 25) + "h（" + pct + "%）");
  p1.font = Font.mediumSystemFont(small ? 10 : 12);
  p1.textColor = ink;
  line.addSpacer(8);
  const p2 = line.addText("🔥" + (d.streak || 0) + "日");
  p2.font = Font.mediumSystemFont(small ? 10 : 12);
  p2.textColor = amber;

  // 今日の予定（中・大サイズのみ）
  if (!small) {
    w.addSpacer(8);
    const plans = (d.plans || []).filter(x => x.date === today);
    const lbl = w.addText(plans.length ? "今日の予定" : "今日の予定はありません");
    lbl.font = Font.boldSystemFont(10);
    lbl.textColor = ink2;
    const max = large ? 8 : 3;
    for (const x of plans.slice(0, max)) {
      w.addSpacer(2);
      const t = w.addText(
        (x.done ? "☑ " : "☐ ") +
        (x.subj || "") +
        (x.min ? " " + Math.round(x.min) + "分" : "") +
        (x.text ? " — " + x.text : "")
      );
      t.font = Font.systemFont(11);
      t.textColor = x.done ? ink2 : ink;
      t.lineLimit = 1;
    }
    if (plans.length > max) {
      w.addSpacer(2);
      const more = w.addText("ほか" + (plans.length - max) + "件");
      more.font = Font.systemFont(10);
      more.textColor = ink2;
    }
  }
  w.addSpacer();
  return w;
}

function addCount(stack, label, days, color, ink2, small){
  const s = stack.addStack();
  s.layoutVertically();
  const l = s.addText(label);
  l.font = Font.systemFont(small ? 9 : 10);
  l.textColor = ink2;
  const v = s.addText(days === null ? "—" : (days >= 0 ? "あと" + days + "日" : "終了"));
  v.font = Font.boldSystemFont(small ? 15 : 18);
  v.textColor = color;
}
