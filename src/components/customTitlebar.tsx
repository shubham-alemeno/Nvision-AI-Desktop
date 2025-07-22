// components/CustomTitlebar.tsx
import React from 'react';
import nvision_icon from '../assets/nvision_logo.ico';
import packageJson from '../../package.json';

interface CustomTitlebarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

const CustomTitlebar: React.FC<CustomTitlebarProps> = ({
  onMinimize,
  onMaximize,
  onClose,
}) => {
  return (
    <div className="h-8 bg-[#2b2b2b] flex justify-between items-center select-none">
      <div className="flex items-center flex-grow pl-3 text-white text-xs font-medium -webkit-app-region-drag">
        {/* <img src={nvision_icon} alt="Nvision AI" className="w-4 h-4 mr-2" /> */}
        <span>Nvision AI</span>
        <span className="ml-2 text-gray-400">v{packageJson.version}</span>
      </div>

      <div className="flex -webkit-app-region-no-drag">
        <button
          className="w-[46px] h-8 text-white text-xs hover:bg-white/10"
          onClick={onMinimize}
        >
          &#8212;
        </button>
        <button
          className="w-[46px] h-8 text-white text-xs hover:bg-white/10"
          onClick={onMaximize}
        >
          □
        </button>
        <button
          className="w-[46px] h-8 text-white text-xs hover:bg-[#e81123]"
          onClick={onClose}
        >
          &#10005;
        </button>
      </div>
    </div>
  );
};

export default CustomTitlebar;
