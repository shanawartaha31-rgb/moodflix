import { useEffect, useRef, useState } from 'react';
import { getWatchInfo, watchUrl, img, countryName } from '../lib/tmdb.js';

/**
 * Shows which services carry a movie.
 *  compact – a single row of logos (used on cards); loads only when scrolled into view.
 *  full    – grouped by Stream / Free / Rent / Buy, with a link to every option.
 */
export default function WhereToWatch({ movie, region, compact = false }) {
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!compact);
  const ref = useRef(null);

  useEffect(() => {
    if (visible || !ref.current) return;
    if (!('IntersectionObserver' in window)) return setVisible(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setInfo(null);
    setFailed(false);
    getWatchInfo(movie.id, region)
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [visible, movie.id, region]);

  const Logo = ({ p }) => (
    <a
      className="wtw-logo"
      href={watchUrl(p, movie.title, info.link)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Watch on ${p.provider_name}`}
      aria-label={`Watch ${movie.title} on ${p.provider_name}`}
    >
      {p.logo_path ? <img src={img(p.logo_path, 'w92')} alt="" /> : <span>{p.provider_name.slice(0, 2)}</span>}
    </a>
  );

  if (failed) return compact ? null : <p className="muted small-text">Couldn't load where to watch right now.</p>;

  if (!info) {
    return (
      <div ref={ref} className="wtw wtw-loading" aria-hidden="true">
        <span /> <span /> <span />
      </div>
    );
  }

  const watchNow = [...info.stream, ...info.free];
  const rentBuy = [...new Map([...info.rent, ...info.buy].map((p) => [p.provider_id, p])).values()];
  const where = countryName(region);

  if (compact) {
    const list = watchNow.length ? watchNow : rentBuy;
    if (!list.length) {
      const e = info.elsewhere[0];
      return (
        <p className="wtw-none">
          {e ? <>Not streaming in {where} · on {e.provider.provider_name} in {countryName(e.region)}</> : <>Not streaming online in {where} yet</>}
        </p>
      );
    }
    return (
      <div className="wtw">
        <span className="wtw-label">{watchNow.length ? 'Watch on' : 'Rent or buy'}</span>
        <div className="wtw-logos">
          {list.slice(0, 4).map((p) => <Logo key={p.provider_id} p={p} />)}
          {list.length > 4 && <span className="wtw-more">+{list.length - 4}</span>}
        </div>
      </div>
    );
  }

  const groups = [
    ['Stream with a subscription', info.stream],
    ['Free', info.free],
    ['Rent', info.rent],
    ['Buy', info.buy],
  ].filter(([, list]) => list.length);

  return (
    <div className="wtw-full">
      <h4>Where to watch in {where}</h4>
      {groups.length ? (
        groups.map(([label, list]) => (
          <div key={label} className="wtw-group">
            <span className="wtw-label">{label}</span>
            <div className="wtw-logos">
              {list.map((p) => <Logo key={p.provider_id} p={p} />)}
            </div>
          </div>
        ))
      ) : (
        <p className="muted small-text">
          Not available online in {where} right now.
          {info.elsewhere.length > 0 &&
            ` Available on ${info.elsewhere.map((e) => `${e.provider.provider_name} in ${countryName(e.region)}`).join(' and ')}.`}
        </p>
      )}
      <p className="wtw-credit">
        <a href={info.link} target="_blank" rel="noopener noreferrer">See all options</a> · Streaming data by JustWatch
      </p>
    </div>
  );
}
