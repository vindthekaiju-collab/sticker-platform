'use strict';

function durumGoster() {
  chrome.runtime.sendMessage({ tip: 'durum' }, d => {
    const s = document.getElementById('sunucu');
    s.textContent = d && d.sunucu ? 'çalışıyor' : 'kapalı';
    s.className = d && d.sunucu ? 'iyi' : 'kotu';
    document.getElementById('kuyruk').textContent = d ? d.kuyruk : '?';
  });
}

document.getElementById('bosalt').addEventListener('click', () => {
  chrome.runtime.sendMessage({ tip: 'kuyruk-bosalt' }, sonuc => {
    durumGoster();
  });
});

durumGoster();
