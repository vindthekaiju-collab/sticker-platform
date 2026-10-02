'use strict';
/**
 * Koleksiyon temaları → emoji. WhatsApp her sticker için en az bir emoji
 * ister (set-paketle.js), mağaza önizlemesi de aynı emojiyi gösterir.
 * Tek yerde dursun: iki dosya ayrı liste tutunca biri eksik kalıyordu.
 */
const EMOJI = {
  'side-eye': '👀', 'say-it-again': '😠', 'dead-inside': '😵', 'crying-rights': '😭',
  'caught-in-4k': '😱', 'not-funny': '😂', 'unhinged': '🤪', 'big-brain': '🤔',
  'hard-no': '🙅', 'certified-sigma': '😎', 'soft-hours': '🥰', 'work-mode': '💻',
  'tea-time': '☕', 'dance-floor': '💃', 'canon-classics': '🐸', 'oops': '😬',
  'snack-time': '😋', 'mixed-reactions': '🙂',
};

/** Tek paket fiyatı — vitrin metni. Paddle'da fiyat kimliği bağlanınca da bu yazı kalır. */
const FIYAT = '$2.99';

module.exports = { EMOJI, FIYAT, emoji: tema => EMOJI[tema] || '🙂' };
