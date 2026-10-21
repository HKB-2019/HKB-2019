import bag from '../assets/empty/bag.webp';
import heart from '../assets/empty/heart.webp';
import search from '../assets/empty/search.webp';
import box from '../assets/empty/box.webp';

/* The owner's 3D pictures for the empty screens (bag, saved, search, orders),
 * cut from design/boards/empty-states.webp. Each sits on a small dark tile,
 * like the board's own panels, so it reads the same in both themes. */

const ART = { bag, heart, search, box };

export default function EmptyArt({ name }) {
  return <img className="empty__art" src={ART[name]} alt="" draggable="false" width="160" height="150" />;
}
