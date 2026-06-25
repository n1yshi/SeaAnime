const API = 'https://azuso.n1yshi.dev';
const PROVIDERS = ['anikoto', 'anineko', 'kiwi', 'pahe', 'zoro', 'arc', 'miruro', 'hianime'];

let mode = 'anime';
let timeout = null;
let anilistId = null;
let epData = null;
let audio = 'sub';
let tmdbId = null;
let tmdbType = null;
let tmdbSeason = 1;

const searchInput = document.getElementById('search-input');
const resultsSection = document.getElementById('results-section');
const detailSection = document.getElementById('detail-section');

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    searchInput.placeholder = mode === 'anime' ? 'Search anime titles...' : 'Search movies...';
    if (searchInput.value.trim()) doSearch();
  });
});

searchInput.addEventListener('input', () => {
  clearTimeout(timeout);
  if (searchInput.value.trim()) {
    timeout = setTimeout(doSearch, 400);
  }
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === 'Escape') {
    if (detailSection.style.display !== 'none') {
      showResults();
    }
  }
});

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  detailSection.style.display = 'none';
  resultsSection.style.display = '';

  resultsSection.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>';

  try {
    if (mode === 'anime') await searchAnime(q);
    else await searchMovie(q);
  } catch (err) {
    resultsSection.innerHTML = '<div class="error">Search failed: ' + escape(err.message) + '</div>';
  }
}

function renderAnimeRows(items) {
  let rows = '';
  items.forEach(m => {
    const title = m.title?.english || m.title?.romaji || 'unknown';
    const cover = m.coverImage?.large || '';
    const ep = m.episodes != null ? m.episodes : '?';
    const score = m.averageScore != null ? m.averageScore : '-';
    const year = m.seasonYear || '';
    const format = m.format || '';

    let cls = 'score-none';
    if (score !== '-') {
      if (score >= 80) cls = 'score-high';
      else if (score >= 60) cls = 'score-good';
      else cls = 'score-low';
    }

    rows += '<tr data-id="' + m.id + '" data-cover="' + escape(cover) + '">' +
      '<td class="title-cell" title="' + escape(title) + '">' + escape(title) + '</td>' +
      '<td>' + ep + '</td>' +
      '<td class="score-cell ' + cls + '">' + score + '</td>' +
      '<td>' + format + '</td>' +
      '<td>' + year + '</td></tr>';
  });
  return rows;
}

function renderMovieRows(items) {
  let rows = '';
  items.forEach(m => {
    const title = m.title || m.originalTitle || 'unknown';
    const poster = m.posterPath || '';
    const type = m.mediaType || '-';
    const year = m.releaseDate ? m.releaseDate.substring(0, 4) : '';
    const vote = m.voteAverage != null ? Number(m.voteAverage).toFixed(1) : '-';

    let cls = 'score-none';
    if (vote !== '-') {
      if (vote >= 7) cls = 'score-high';
      else if (vote >= 5) cls = 'score-good';
      else cls = 'score-low';
    }

    rows += '<tr data-id="' + m.id + '" data-type="' + type + '" data-cover="' + escape(poster) + '">' +
      '<td class="title-cell" title="' + escape(title) + '">' + escape(title) + '</td>' +
      '<td>' + type + '</td>' +
      '<td class="score-cell ' + cls + '">' + vote + '</td>' +
      '<td>' + year + '</td></tr>';
  });
  return rows;
}

async function searchAnime(q) {
  const res = await fetch(`${API}/search?query=${encodeURIComponent(q)}&page=1&per_page=50`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const items = data.results || [];

  if (!items.length) {
    resultsSection.innerHTML = '<div class="no-results">No results found</div>';
    return;
  }

  let html = '<div class="result-count">' + items.length + ' results</div>' +
    '<div class="table-wrap"><table class="result-table">' +
    '<thead><tr><th>Title</th><th>Episodes</th><th>Score</th><th>Format</th><th>Year</th></tr></thead><tbody>' +
    renderAnimeRows(items) +
    '</tbody></table></div>';

  resultsSection.innerHTML = html;

  resultsSection.querySelectorAll('.result-table tbody tr').forEach(row => {
    row.addEventListener('click', () => openAnime(row.dataset.id));
    row.addEventListener('mouseenter', showCoverPopup);
    row.addEventListener('mousemove', moveCoverPopup);
    row.addEventListener('mouseleave', hideCoverPopup);
  });
}

async function searchMovie(q) {
  const res = await fetch(`${API}/movie/search?query=${encodeURIComponent(q)}&page=1`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const items = data.data?.results || [];

  if (!items.length) {
    resultsSection.innerHTML = '<div class="no-results">No results found</div>';
    return;
  }

  let html = '<div class="result-count">' + items.length + ' results</div>' +
    '<div class="table-wrap"><table class="result-table">' +
    '<thead><tr><th>Title</th><th>Type</th><th>Rating</th><th>Year</th></tr></thead><tbody>' +
    renderMovieRows(items) +
    '</tbody></table></div>';

  resultsSection.innerHTML = html;

  resultsSection.querySelectorAll('.result-table tbody tr').forEach(row => {
    row.addEventListener('click', () => openMovie(row.dataset.id, row.dataset.type));
    row.addEventListener('mouseenter', showCoverPopup);
    row.addEventListener('mousemove', moveCoverPopup);
    row.addEventListener('mouseleave', hideCoverPopup);
  });
}

function showResults() {
  detailSection.style.display = 'none';
  resultsSection.style.display = '';
}


async function openAnime(id) {
  anilistId = id;
  resultsSection.style.display = 'none';
  detailSection.style.display = 'block';
  detailSection.innerHTML = '<div class="detail-loading"><div class="spinner"></div>Loading...</div>';

  const [infoData, epDataRaw] = await Promise.all([
    fetchInfo(id),
    fetchEpisodes(id),
  ]);

  if (!infoData && !epDataRaw) {
    detailSection.innerHTML = '<div class="error">Failed to load data</div>';
    return;
  }

  const title = infoData?.title?.english || infoData?.title?.romaji || '';
  tmdbId = null;
  tmdbType = null;
  tmdbSeason = 1;
  if (title) {
    try {
      const tmdbRes = await fetch(`${API}/movie/search?query=${encodeURIComponent(title)}&page=1`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        const tmdbResults = tmdbData.data?.results || [];
        if (tmdbResults.length) {
          tmdbId = tmdbResults[0].id;
          tmdbType = tmdbResults[0].mediaType || 'tv';
        }
      }
    } catch {}

    // Fallback: strip season suffixes ("Season 2", "S2", "Part X", trailing numbers)
    let baseTitle = title;
    if (!tmdbId) {
      baseTitle = title
        .replace(/[-–—]\s*(?:\d+(?:st|nd|rd|th)?\s*Season|Season\s*\d+|S\s*\d+|Part\s*\d+)/i, '')
        .replace(/(?:\d+(?:st|nd|rd|th)?\s*Season|Season\s*\d+|S\s*\d+|Part\s*\d+)/i, '')
        .replace(/\s+\d+$/, '')
        .trim();
      if (baseTitle && baseTitle !== title) {
        try {
          const tmdbRes2 = await fetch(`${API}/movie/search?query=${encodeURIComponent(baseTitle)}&page=1`);
          if (tmdbRes2.ok) {
            const tmdbData2 = await tmdbRes2.json();
            const tmdbResults2 = tmdbData2.data?.results || [];
            if (tmdbResults2.length) {
              tmdbId = tmdbResults2[0].id;
              tmdbType = tmdbResults2[0].mediaType || 'tv';
            }
          }
        } catch {}
      }
    }

    // Extract TMDB season number from title
    if (tmdbId && tmdbType === 'tv') {
      let seasonNum = 1;
      let m = title.match(/(?:Season|S|Part)\s*(\d+)/i);
      if (!m) m = title.match(/(\d+)\s*(?:st|nd|rd|th)?\s*Season/i);
      if (m) {
        seasonNum = parseInt(m[1]);
      } else if (baseTitle && baseTitle !== title) {
        const diff = title.replace(baseTitle, '').trim();
        const n = diff.match(/(\d+)/);
        if (n) seasonNum = parseInt(n[1]);
      }
      tmdbSeason = seasonNum;
    }
  }

  renderAnimeDetail(infoData, epDataRaw);
}

async function fetchInfo(id) {
  try {
    const res = await fetch(`${API}/info/${id}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchEpisodes(id) {
  try {
    const res = await fetch(`${API}/episodes/${id}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch {
    return null;
  }
}

function flatten(data, parentKey) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) {
    const r = [];
    data.forEach(v => {
      if (v && typeof v === 'object' && (v.number || v.episode || v.episodeNumber || v.title)) {
        if (parentKey) v._p = parentKey;
        r.push(v);
      }
    });
    return r;
  }
  if (Array.isArray(data.episodes)) return flatten(data.episodes, parentKey);
  if (Array.isArray(data.data)) return flatten(data.data, parentKey);
  if (Array.isArray(data.results)) return flatten(data.results, parentKey);
  if (Array.isArray(data.list)) return flatten(data.list, parentKey);

  const all = [];
  for (const key in data) {
    const val = data[key];
    const isP = PROVIDERS.indexOf(key) !== -1;
    const p = isP ? key : (parentKey || null);
    if (Array.isArray(val)) all.push(...flatten(val, p));
    else if (val && typeof val === 'object') all.push(...flatten(val, p));
  }
  return all;
}

function renderAnimeDetail(info, episodesRaw) {
  const title = info?.title?.english || info?.title?.romaji || info?.title?.native || 'Unknown';
  const desc = (info?.description || 'No description').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  const cover = info?.coverImage?.extraLarge || info?.coverImage?.large || '';
  const ep = info?.episodes != null ? info.episodes : '?';
  const score = info?.averageScore != null ? (info.averageScore / 10).toFixed(1) : '-';
  const year = info?.seasonYear || '';
  const format = info?.format || '';
  const meta = [ep + ' episodes', score, year, format].filter(Boolean).join(' | ');

  let html =
    '<button class="detail-back" onclick="showResults()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> Back to results</button>' +
    '<div class="detail-main">' +
      (cover ? '<img class="detail-cover" src="' + cover + '" alt="">' : '<div class="detail-cover-placeholder"></div>') +
      '<div class="detail-info">' +
        '<div class="detail-title">' + escape(title) + '</div>' +
        '<div class="detail-meta">' + meta + '</div>' +
        '<div class="detail-desc">' + escape(desc) + '</div>' +
      '</div>' +
    '</div>';

  
  const all = flatten(episodesRaw);
  const grouped = {};
  all.forEach(ep => {
    const num = ep.number || ep.episode || ep.episodeNumber || ep.episode_number;
    if (!num) return;
    if (!grouped[num]) grouped[num] = { number: num, title: '', image: '', description: '' };
    const g = grouped[num];
    if (ep.title && !g.title) g.title = ep.title;
    if ((ep.image || ep.thumbnail || ep.thumb || ep.cover) && !g.image)
      g.image = ep.image || ep.thumbnail || ep.thumb || ep.cover;
    if (ep.description && !g.description) g.description = ep.description;
  });

  let eps = Object.values(grouped).sort((a, b) => a.number - b.number);

  if (eps.length) {
    html += '<div class="detail-episodes"><h3>Episodes <span class="ep-count">(' + eps.length + ')</span></h3><div class="ep-list">';
    eps.forEach(ep => {
      const t = ep.title || 'Episode ' + ep.number;
      const d = ep.description ? '<div class="ep-desc">' + escape(ep.description.substring(0, 120)) + (ep.description.length > 120 ? '...' : '') + '</div>' : '';
      html += '<div class="ep-item" data-ep="' + ep.number + '">';
      if (ep.image) html += '<img class="ep-thumb" src="' + ep.image + '" alt="" loading="lazy">';
      else html += '<div class="ep-thumb-placeholder"></div>';
      html += '<div class="ep-meta"><div class="ep-num">EP ' + ep.number + '</div><div class="ep-title">' + escape(t) + '</div>' + d + '</div></div>';
    });
    html += '</div></div>';
  }

  detailSection.innerHTML = html;

  detailSection.querySelectorAll('.ep-item').forEach(row => {
    row.addEventListener('click', () => {
      const epData = eps.find(e => String(e.number) === row.dataset.ep);
      if (epData) showAnimeStreams(epData);
    });
  });
}

async function showAnimeStreams(ep) {
  epData = ep;

  let epHtml =
    '<button class="detail-back" id="stream-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> Back to episodes</button>' +
    '<div class="stream-section">' +
      '<div class="stream-header">' +
        '<div class="stream-ep-label">Episode <b>' + ep.number + '</b> &mdash; ' + escape(ep.title || 'Episode ' + ep.number) + '</div>' +
        '<div class="audio-toggle">' +
          '<button class="audio-btn active" data-audio="sub">Sub</button>' +
          '<button class="audio-btn" data-audio="dub">Dub</button>' +
        '</div>' +
      '</div>';

  if (tmdbId) {
    epHtml += '<div class="embed-list" id="tmdb-embed-list"><div class="stream-placeholder">Loading TMDB streams...</div></div>' +
      '<div class="collapse-section">' +
        '<div class="collapse-toggle" onclick="toggleCollapse(this)">Anime providers <span class="collapse-arrow">▶</span></div>' +
        '<div class="collapse-content">' +
          '<div class="embed-list" id="embed-list"><div class="stream-placeholder">Loading streams...</div></div>' +
        '</div>' +
      '</div>';
  } else {
    epHtml += '<div class="embed-list" id="embed-list"><div class="stream-placeholder">Loading streams...</div></div>';
  }

  epHtml += '</div>';

  detailSection.innerHTML = epHtml;

  document.querySelectorAll('.audio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      audio = btn.dataset.audio;
      const el = document.getElementById('embed-list');
      if (el) el.innerHTML = '<div class="stream-placeholder">Loading streams...</div>';
      fetchStreams();
    });
  });

  document.getElementById('stream-back').addEventListener('click', () => {
    openAnime(anilistId);
  });

  const promises = [fetchStreams()];
  if (tmdbId) promises.push(fetchTmdbStreams());
  await Promise.all(promises);
}

async function fetchTmdbStreams() {
  const list = document.getElementById('tmdb-embed-list');
  if (!list) return;

  try {
    const res = await fetch(`${API}/movie/streams?type=${tmdbType}&id=${tmdbId}` + (tmdbType === 'tv' ? '&season=' + tmdbSeason + '&episode=' + epData.number : ''));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const embeds = data?.data?.embeds || data?.embeds || {};
    const entries = Object.entries(embeds).filter(([, v]) => typeof v === 'string' && v.startsWith('http'));

    if (entries.length) {
      list.innerHTML = entries.map(([provider, url]) => renderStreamBtn(url, provider)).join('');
      initHlsPlayers();
    } else {
      list.innerHTML = '<div class="stream-placeholder">No TMDB streams available</div>';
    }
  } catch {
    list.innerHTML = '<div class="stream-placeholder">No TMDB streams available</div>';
  }
}

async function fetchStreams() {
  const fetches = PROVIDERS.map(p =>
    fetch(`${API}/watch/${p}/${anilistId}/${audio}/${epData.number}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );

  const results = await Promise.all(fetches);
  const embeds = [];

  results.forEach((data, idx) => {
    if (!data) return;
    const streams = extract(data);
    if (streams) {
      streams.forEach(s => { s._p = PROVIDERS[idx]; });
      embeds.push(...streams);
    }
  });

  const list = document.getElementById('embed-list');
  if (!list) return;

  if (!embeds.length) {
    list.innerHTML = '<div class="stream-placeholder">No streams available</div>';
    return;
  }

  list.innerHTML = embeds.map(s => {
      const label = s._p + (s.server ? ' | ' + s.server : '');
      return renderStreamBtn(s.url, label);
    }).join('');
  initHlsPlayers();
}

function extract(data) {
  if (Array.isArray(data.streams) && data.streams.length) return data.streams;
  const candidates = [audio, 'ssub', 'sdub', 'sub', 'dub'];
  for (const c of candidates) {
    const s = data[c];
    if (s && Array.isArray(s.streams) && s.streams.length) return s.streams;
  }
  return null;
}


let tvState = null;

async function openMovie(id, type) {
  resultsSection.style.display = 'none';
  detailSection.style.display = 'block';
  detailSection.innerHTML = '<div class="detail-loading"><div class="spinner"></div>Loading...</div>';

  const infoData = await fetch(`${API}/movie/info?type=${type}&id=${id}`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

  if (!infoData) {
    detailSection.innerHTML = '<div class="error">Failed to load data</div>';
    return;
  }

  if (type === 'tv') {
    tvState = { id, type };
    const seasonsData = await fetch(`${API}/movie/seasons?type=tv&id=${id}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    const seasons = seasonsData?.data?.seasons || null;
    renderTVDetail(infoData, seasons);
  } else {
    tvState = null;
    const streamsData = await fetch(`${API}/movie/streams?type=movie&id=${id}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    renderMovieDetail(infoData, streamsData);
  }
}

function renderMovieDetail(infoData, streamsData) {
  const main = infoData?.data || infoData?.results || infoData || {};
  const title = main.title || main.name || main.originalTitle || main.original_name || 'Unknown';
  const desc = main.overview || main.description || 'No description';
  const poster = main.posterPath || main.poster_path || '';
  const year = (main.releaseDate || main.release_date || '').substring(0, 4);
  const rating = main.voteAverage ?? main.vote_average;
  const ratingStr = rating != null ? Number(rating).toFixed(1) : '-';
  const meta = ['Movie', year, ratingStr + ' / 10'].filter(Boolean).join(' | ');

  let html =
    '<button class="detail-back" onclick="showResults()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> Back to results</button>' +
    '<div class="detail-main">' +
      (poster ? '<img class="detail-cover" src="' + poster + '" alt="">' : '<div class="detail-cover-placeholder"></div>') +
      '<div class="detail-info">' +
        '<div class="detail-title">' + escape(title) + '</div>' +
        '<div class="detail-meta">' + meta + '</div>' +
        '<div class="detail-desc">' + escape(desc) + '</div>' +
      '</div>' +
    '</div>';

  const embeds = streamsData?.data?.embeds || streamsData?.embeds || {};
  const embedEntries = Object.entries(embeds).filter(([, v]) => typeof v === 'string' && v.startsWith('http'));

  if (embedEntries.length) {
    html += '<div class="detail-episodes"><h3>Watch</h3><div class="embed-list">';
    embedEntries.forEach(([provider, url]) => {
      html += renderStreamBtn(url, provider);
    });
    html += '</div></div>';
  } else {
    html += '<div class="detail-episodes"><h3>Watch</h3><div class="stream-placeholder">No streams available</div></div>';
  }

  detailSection.innerHTML = html;
  initHlsPlayers();
}

function renderTVDetail(infoData, seasonsFallback) {
  const main = infoData?.data || infoData?.results || infoData || {};
  const title = main.title || main.name || main.originalTitle || main.original_name || 'Unknown';
  const desc = main.overview || main.description || 'No description';
  const poster = main.posterPath || main.poster_path || '';
  const year = (main.firstAirDate || main.first_air_date || '').substring(0, 4);
  const rating = main.voteAverage ?? main.vote_average;
  const ratingStr = rating != null ? Number(rating).toFixed(1) : '-';
  const meta = ['TV', year, ratingStr + ' / 10'].filter(Boolean).join(' | ');

  let seasons = (main.seasons || []).filter(s => {
    const n = s.seasonNumber ?? s.season_number;
    return n != null && n > 0;
  }).map(s => ({
    seasonNumber: s.seasonNumber ?? s.season_number,
    name: s.name || 'Season ' + (s.seasonNumber ?? s.season_number),
    episodeCount: s.episodeCount ?? s.episode_count,
  })).sort((a, b) => a.seasonNumber - b.seasonNumber);

  if (seasons.length <= 1 && seasonsFallback?.length > 1) {
    seasons = seasonsFallback;
  } else if (!seasons.length && main.numberOfSeasons > 1) {
    for (let i = 1; i <= main.numberOfSeasons; i++) {
      seasons.push({ seasonNumber: i, name: 'Season ' + i, episodeCount: '?' });
    }
  }

  let html =
    '<button class="detail-back" onclick="showResults()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> Back to results</button>' +
    '<div class="detail-main">' +
      (poster ? '<img class="detail-cover" src="' + poster + '" alt="">' : '<div class="detail-cover-placeholder"></div>') +
      '<div class="detail-info">' +
        '<div class="detail-title">' + escape(title) + '</div>' +
        '<div class="detail-meta">' + meta + '</div>' +
        '<div class="detail-desc">' + escape(desc) + '</div>' +
      '</div>' +
    '</div>';

  if (seasons.length > 1) {
    html += '<div class="season-select"><label>Season</label><select id="season-select">';
    seasons.forEach(s => {
      html += '<option value="' + s.seasonNumber + '">' + escape(s.name) + ' (' + (s.episodeCount || '?') + ' eps)</option>';
    });
    html += '</select></div>';
  }

  html += '<div class="detail-episodes" id="tv-episodes"><h3>Episodes</h3><div class="detail-loading"><div class="spinner"></div></div></div>';

  detailSection.innerHTML = html;

  const sel = document.getElementById('season-select');
  const firstSeason = seasons.length ? seasons[0].seasonNumber : 1;
  if (sel) sel.addEventListener('change', () => fetchTVEpisodes(tvState.id, parseInt(sel.value)));
  fetchTVEpisodes(tvState.id, firstSeason);
}

async function fetchTVEpisodes(id, season) {
  const container = document.getElementById('tv-episodes');
  if (!container) return;

  try {
    const res = await fetch(`${API}/movie/info?type=tv&id=${id}&season=${season}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const main = data.data || data.results || data || {};
    const eps = main.episodes || [];

    let html = '<h3>Season ' + season + ' <span class="ep-count">(' + eps.length + ' episodes)</span></h3><div class="ep-list">';
    eps.forEach(ep => {
      const t = ep.name || 'Episode ' + ep.episodeNumber;
      const d = ep.overview ? '<div class="ep-desc">' + escape(ep.overview.substring(0, 120)) + (ep.overview.length > 120 ? '...' : '') + '</div>' : '';
      const img = ep.stillPath || '';
      html += '<div class="ep-item" data-season="' + season + '" data-ep="' + ep.episodeNumber + '">';
      if (img) html += '<img class="ep-thumb" src="' + img + '" alt="" loading="lazy">';
      else html += '<div class="ep-thumb-placeholder"></div>';
      html += '<div class="ep-meta"><div class="ep-num">S' + season + ' E' + ep.episodeNumber + '</div><div class="ep-title">' + escape(t) + '</div>' + d + '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.ep-item').forEach(row => {
      row.addEventListener('click', () => {
        showTVStreams(tvState.id, parseInt(row.dataset.season), parseInt(row.dataset.ep));
      });
    });
  } catch (err) {
    container.innerHTML = '<h3>Season ' + season + '</h3><div class="error">Failed to load episodes</div>';
  }
}

async function showTVStreams(id, season, ep) {
  const container = document.getElementById('tv-episodes');
  if (!container) return;

  container.innerHTML = '<div class="detail-loading"><div class="spinner"></div>Loading streams...</div>';

  try {
    const res = await fetch(`${API}/movie/streams?type=tv&id=${id}&season=${season}&episode=${ep}&resolve=true`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const embeds = data?.data?.embeds || data?.embeds || {};
    const entries = Object.entries(embeds).filter(([, v]) => typeof v === 'string' && v.startsWith('http'));
    const resolved = data?.data?.resolvedStreams || {};

    let html =
      '<button class="detail-back" id="tv-stream-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> Back to episodes</button>' +
      '<div class="stream-section">' +
        '<div class="stream-header">' +
          '<div class="stream-ep-label">S' + season + ' E' + ep + '</div>' +
        '</div>';

    if (entries.length || Object.keys(resolved).length) {
      html += '<div class="embed-list">';
      entries.forEach(([provider, url]) => {
        html += renderStreamBtn(url, provider);
      });
      for (const [, streams] of Object.entries(resolved)) {
        for (const s of streams) {
          if (s.type === 'hls' || s.type === 'mp4') {
            html += renderStreamBtn(s.url, 'donkey');
          }
        }
      }
      html += '</div>';
    } else {
      html += '<div class="stream-placeholder">No streams available</div>';
    }

    container.innerHTML = html;
    initHlsPlayers();

    document.getElementById('tv-stream-back').addEventListener('click', () => {
      if (tvState) fetchTVEpisodes(tvState.id, season);
    });
  } catch (err) {
    container.innerHTML = '<div class="error">Failed to load streams</div>';
  }
}

function toggleCollapse(btn) {
  const content = btn.nextElementSibling;
  if (!content) return;
  content.classList.toggle('expanded');
  btn.querySelector('.collapse-arrow').textContent =
    content.classList.contains('expanded') ? '▼' : '▶';
}

function escape(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function isM3u8(url) {
  return url && url.includes('.m3u8');
}

function renderStreamBtn(url, label) {
  if (!url) return '';
  if (isM3u8(url)) {
    return '<div class="hls-player" data-url="' + url + '">' +
      '<div class="hls-header"><span class="provider-label">' + label + '</span></div>' +
      '<video controls width="100%" preload="metadata"></video></div>';
  }
  return '<a href="' + url + '" target="_blank" rel="noopener" class="embed-btn">' +
    '<span><span class="provider-label">' + label + '</span></span>' +
    '<span class="play-arrow">Play &rarr;</span></a>';
}

function initHlsPlayers() {
  document.querySelectorAll('.hls-player').forEach(el => {
    const video = el.querySelector('video');
    const url = el.dataset.url;
    if (!video || !url) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    }
  });
}

const coverPopup = document.getElementById('cover-popup');

function showCoverPopup(e) {
  const url = e.currentTarget.dataset.cover;
  if (!url) return;
  coverPopup.src = url;
  coverPopup.style.display = 'block';
  positionCoverPopup(e);
}

function moveCoverPopup(e) {
  if (coverPopup.style.display === 'block') {
    positionCoverPopup(e);
  }
}

function positionCoverPopup(e) {
  let x = e.clientX + 16;
  let y = e.clientY - 85;
  if (x + 120 > window.innerWidth) x = e.clientX - 136;
  if (y < 0) y = e.clientY + 16;
  coverPopup.style.left = x + 'px';
  coverPopup.style.top = y + 'px';
}

function hideCoverPopup() {
  coverPopup.style.display = 'none';
  coverPopup.src = '';
}
