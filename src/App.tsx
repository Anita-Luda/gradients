import { useState, useMemo } from 'react';
import { Sun, Moon, Eye, Shuffle, RotateCcw, Maximize, Copy, Check } from 'lucide-react';
import { parseHexList, groupHues } from './lib/colors';
import { generateGradient } from './lib/engine';
import type { GradientOptions, Geometry } from './lib/engine';

const DEFAULT_HEX = '#f94144, #f3722c, #f8961e, #f9844a, #f9c74f, #90be6d, #43aa8b, #4d908e, #577590, #277da1';

export default function App() {
  const [hexInput, setHexInput] = useState(DEFAULT_HEX);
  const [sidebarTheme, setSidebarTheme] = useState<'light' | 'dark'>('dark');
  const [previewBg, setPreviewBg] = useState<'white' | 'black'>('black');

  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<GradientOptions>({
    preset: 'sunset',
    mood: 500,
    contrast: 100,
    density: 50,
    hueLimit: 5,
    geometry: 'linear',
    angle: 135,
    inverted: false,
    mirrored: false,
    hueSeed: 0
  });

  const colorPool = useMemo(() => parseHexList(hexInput), [hexInput]);
  const hueGroupsCount = useMemo(() => Array.from(groupHues(colorPool).values()).length, [colorPool]);

  const gradientCss = useMemo(() => {
    return generateGradient(colorPool, options);
  }, [colorPool, options]);

  const addColor = (hex: string) => {
    const clean = hexInput.trim();
    const separator = clean.endsWith(',') ? ' ' : (clean.length > 0 ? ', ' : '');
    setHexInput(clean + separator + hex);
  };

  const handleShuffle = () => {
    setOptions(prev => ({
      ...prev,
      hueSeed: prev.hueSeed + 1
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`background: ${gradientCss};`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="app-container">
      <aside className={`sidebar ${sidebarTheme}`}>
        <h1>
          Gradient Engine
          <button className="icon-button" onClick={() => setSidebarTheme(t => t === 'light' ? 'dark' : 'light')}>
            {sidebarTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </h1>

        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Kody HEX</label>
            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{colorPool.length}</span>
          </div>
          <textarea
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="#HEX, #HEX..."
          />
          <div className="button-grid" style={{ marginTop: '4px' }}>
            <button onClick={() => addColor('#FFFFFF')}>+ Biały</button>
            <button onClick={() => addColor('#000000')}>+ Czarny</button>
          </div>
        </div>

        <div className="control-group">
          <label>Preset Atmosferyczny</label>
          <select
            value={options.preset}
            onChange={(e) => setOptions({...options, preset: e.target.value})}
          >
            <option value="hologram">Hologram / Opal</option>
            <option value="sunset">Zachód Słońca</option>
            <option value="reflex">Kropla Wody / Refleks</option>
            <option value="aurora">Zorza Polarna</option>
            <option value="galaxy">Galaktyka / Mgławica</option>
            <option value="magma">Płynna Magma</option>
            <option value="cyberpunk">Cyberpunk / Neon</option>
            <option value="chrome">Liquid Chrome (Classic)</option>
            <option value="liquid-metal">Liquid Metal / Chrome V1</option>
            <option value="ethereal">Ethereal / Mist</option>
            <option value="abyss">Abyss / Deep Sea</option>
            <option value="light-top">Oświetlenie Górne</option>
            <option value="light-side">Oświetlenie Boczne</option>
            <option value="vignette">Winieta / Spotlight</option>
            <option value="ripples">Kręgi na Wodzie</option>
            <option value="default">Standardowy (Wszystkie)</option>
          </select>
        </div>

        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label>Liczba Odcieni (Families)</label>
            <span>{Math.min(options.hueLimit, hueGroupsCount)} / {hueGroupsCount}</span>
          </div>
          <input
            type="range"
            min="1"
            max={Math.max(1, hueGroupsCount)}
            value={options.hueLimit}
            onChange={(e) => setOptions({...options, hueLimit: parseInt(e.target.value)})}
          />
        </div>

        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label>Jasność Bazowa (Mood)</label>
            <span>{options.mood}</span>
          </div>
          <input type="range" min="0" max="1000" value={options.mood} onChange={(e) => setOptions({...options, mood: parseInt(e.target.value)})} />
        </div>

        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label>Dynamika / Kontrast</label>
            <span>{options.contrast}%</span>
          </div>
          <input type="range" min="0" max="100" value={options.contrast} onChange={(e) => setOptions({...options, contrast: parseInt(e.target.value)})} />
        </div>

        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label>Gęstość</label>
            <span>{options.density}%</span>
          </div>
          <input type="range" min="0" max="100" value={options.density} onChange={(e) => setOptions({...options, density: parseInt(e.target.value)})} />
        </div>

        <div className="control-group">
          <label>Geometria</label>
          <div className="geometry-tabs">
            {(['linear', 'radial', 'conic', 'mesh'] as Geometry[]).map(g => (
              <button
                key={g}
                className={options.geometry === g ? 'active' : ''}
                onClick={() => setOptions({...options, geometry: g})}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {options.geometry !== 'radial' && options.geometry !== 'mesh' && (
          <div className="control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Kąt</label>
              <span>{options.angle}°</span>
            </div>
            <input type="range" min="0" max="360" value={options.angle} onChange={(e) => setOptions({...options, angle: parseInt(e.target.value)})} />
          </div>
        )}

        <div className="button-grid">
          <button onClick={() => setOptions({...options, inverted: !options.inverted})}>
            <RotateCcw size={14} style={{ marginRight: 4 }} />
            Odwróć
          </button>
          <button onClick={handleShuffle}>
            <Shuffle size={14} style={{ marginRight: 4 }} />
            Mieszaj
          </button>
          <button onClick={() => setOptions({...options, mirrored: !options.mirrored})} style={{ gridColumn: 'span 2' }}>
            <Maximize size={14} style={{ marginRight: 4 }} />
            Lustro (Mirror)
          </button>
          <button
            onClick={copyToClipboard}
            style={{ gridColumn: 'span 2', background: 'var(--text)', color: 'var(--bg)' }}
          >
            {copied ? <Check size={14} style={{ marginRight: 4 }} /> : <Copy size={14} style={{ marginRight: 4 }} />}
            {copied ? 'Skopiowano!' : 'Kopiuj CSS'}
          </button>
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.6rem', opacity: 0.3 }}>
          V1.9 DESIGNER CORE &bull; OKLCH ENGINE
        </div>
      </aside>

      <main className="preview-container" style={{ background: previewBg }}>
        <div
          className="gradient-preview"
          style={{ background: gradientCss }}
        />
        <button
          className="preview-toggle"
          onClick={() => setPreviewBg(b => b === 'white' ? 'black' : 'white')}
          title="Przełącz tło podglądu"
        >
          <Eye size={20} color={previewBg === 'white' ? '#000' : '#fff'} />
        </button>
      </main>
    </div>
  );
}
