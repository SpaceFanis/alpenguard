import { PointMountain } from './components/PointMountain';
import { Waits, Rules, Compare, Limits, Footer } from './components/Sections';
import { Problem } from './components/Why';
import { Demo } from './components/Demo';
import { useMotion } from './lib/motion';

export default function App() {
  useMotion();
  return (
    <>
      <a className="skip" href="#demo">Skip to the demo</a>
      <main>
        <PointMountain />
        <Problem />
        <Waits />
        <Demo />
        <Rules />
        <Compare />
        <Limits />
      </main>
      <Footer />
    </>
  );
}
