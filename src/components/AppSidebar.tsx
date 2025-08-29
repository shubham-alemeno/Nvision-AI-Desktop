import { BookOpen, Bot, Gpu, Settings2, SquareTerminal } from 'lucide-react';
import React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { AudioWaveform, Command, GalleryVerticalEnd } from 'lucide-react';
import { NavMain } from '@/components/NavMain';
import { NavUser } from '@/components/NavUser';
import { TeamSwitcher } from './team-switcher';
import { useAppMode } from '../contexts/appModeContext';
// import nvision_logo from '../assets/nvision_logo.png';

// This is sample data
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Nvision AI',
      logo: GalleryVerticalEnd,
      plan: '',
    },
  ],
  navMain: [
    {
      title: 'Data Collection',
      url: '#data-collection',
      icon: SquareTerminal,
      isActive: true,
    },
    {
      title: 'Defect Checker',
      url: '#defect-checker',
      icon: Gpu,
      items: [],
    },
    {
      title: 'Past Data',
      url: '#past-data',
      icon: Bot,
      items: [],
    },
    {
      title: 'Data Collection Summary',
      url: '#summary',
      icon: BookOpen,
      items: [],
    },
    {
      title: 'App settings',
      url: '#settings',
      icon: Settings2,
      items: [
        {
          title: 'Defect Checker Usage',
          url: '#usage-data',
        },
        {
          title: 'Pattern EBC',
          url: '#pattern-ebc',
        },
        {
          title: 'Admin Settings',
          url: '#admin-settings',
        },
        // {
        //   title: 'Defect Configuration',
        //   url: '#defect-configuration',
        // },
        // {
        //   title: 'Team',
        //   url: '#settings-team',
        // },
        // {
        //   title: 'Billing',
        //   url: '#settings-billing',
        // },
      ],
    },
  ],
};

const AppSidebar = ({
  handleLogout,
  onNavigate,
  activePage,
  username,
  userData,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  handleLogout: () => void;
  onNavigate: (page: string) => void;
  activePage: string;
  username?: string;
}) => {
  console.log(userData)
  const { isTestMode, setIsTestMode } = useAppMode();
  const { state } = useSidebar();
  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="top-8 h-[calc(100vh-32px)]"
    >
      <SidebarHeader>
        <div className="flex flex-col gap-2 w-full">
          <TeamSwitcher teams={data.teams} />
          <div className="mt-2">
            <div
              className={`transition-all duration-200 overflow-hidden ${
                state === 'expanded'
                  ? 'max-h-20 opacity-100'
                  : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-center">
                {/* <span className="font-semibold text-xs">App mode:</span> */}
                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    className={`px-4 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                      !isTestMode
                        ? 'bg-green-500 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    onClick={() => setIsTestMode(false)}
                  >
                    Production
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                      isTestMode
                        ? 'bg-yellow-500 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    onClick={() => setIsTestMode(true)}
                  >
                    Test
                  </button>
                </div>
              </div>
            </div>
            <div
              className={`transition-all duration-200 flex items-center justify-center ${
                state !== 'expanded'
                  ? 'opacity-100 max-h-10'
                  : 'opacity-0 max-h-0 pointer-events-none'
              }`}
            >
              <button
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isTestMode
                    ? 'bg-yellow-500 text-gray-900 shadow-sm'
                    : 'bg-green-500 text-gray-900 shadow-sm'
                }`}
                title={isTestMode ? 'Test Mode' : 'Production Mode'}
                onClick={() => setIsTestMode(!isTestMode)}
              >
                {isTestMode ? (
                  <span className="text-xs font-bold">T</span>
                ) : (
                  <span className="text-xs font-bold">P</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          onNavigate={onNavigate}
          activePage={activePage}
          userData={userData}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: username || '',
            email: '',
            avatar: '',
          }}
          handleLogout={handleLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
