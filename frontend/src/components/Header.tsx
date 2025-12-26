import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div>
              <h1 className="header-title">Safe Haven</h1>
              <div className="header-subtitle">Confidential documents with FHE keys and client-side encryption</div>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
