import dark from '../assets/wordmark-dark.webp';
import light from '../assets/wordmark-light.webp';

/* The brush MASQ. from the logo. Its first letter is cream, which a light
 * page would lose, so the light theme has a copy with that letter in ink;
 * the stylesheet shows the one that suits the ground it sits on. */
export default function Wordmark({ alt = 'MASQ.' }) {
  return (
    <span className="wordmark">
      <img className="wordmark__dark" src={dark} alt={alt} width="344" height="132" decoding="async" />
      <img className="wordmark__light" src={light} alt="" aria-hidden="true" width="344" height="132" decoding="async" />
    </span>
  );
}
