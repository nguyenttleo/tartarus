// Phosphor CRT dressing: scanlines + vignette + a drifting scan beam.
// Both layers are pointer-events:none and sit below `.screen` (z-61), so the
// code editor and run outputs punch through and stay unfiltered.
export function Crt() {
  return (
    <>
      <div className="crt" aria-hidden />
      <div className="scanbeam" aria-hidden />
    </>
  );
}
