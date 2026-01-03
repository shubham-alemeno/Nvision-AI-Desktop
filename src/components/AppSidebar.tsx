import {
  BookOpen,
  Bot,
  CheckCheck,
  CheckCircle,
  CheckIcon,
  CheckLine,
  CheckSquare,
  Gpu,
  History,
  LayoutDashboard,
  LucideAirVent,
  LucideFileWarning,
  NotepadText,
  PenBox,
  Settings2,
  SquareTerminal,
} from 'lucide-react';
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
    // OPERATIONS Section
    {
      title: 'Dashboard',
      url: '#dashboard',
      icon: LayoutDashboard,
      isActive: true,
      section: 'operations',
    },
    {
      title: 'Defect Checker',
      url: '#defect-checker',
      icon: Gpu,
      section: 'operations',
    },
    {
      title: 'NTF Checker',
      url: '#ntf-checker',
      icon: Bot,
      section: 'operations',
    },
    {
      title: 'Data Collection',
      url: '#data-collection',
      icon: SquareTerminal,
      isActive: true,
      section: 'operations',
    },
    {
      title: 'Self Learning',
      url: '#self-learning',
      icon: PenBox,
      isActive: true,
      section: 'operations',
      items: [
        {
          title: 'Self Learning',
          url: '#self-learning',
        },
        {
          title: 'Self Learning Data',
          url: '#self-learning-data',
        },
        {
          title: 'Self Learning Summary',
          url: '#self-learning-summary',
        },
        {
          title: 'New Model Training',
          url: '#new-model-training',
        },
      ],
    },
    // HISTORY & REPORTS Section
    {
      title: 'Past Data',
      url: '#past-data',
      icon: History,
      section: 'history',
    },
    {
      title: 'Summary',
      url: '#summary',
      icon: BookOpen,
      section: 'history',
    },
    {
      title: 'Usage Data',
      url: '#usage-data',
      icon: NotepadText,
      section: 'history',
    },
    // SETTINGS Section (Flattened - no more collapsible)
    {
      title: 'Pattern EBC',
      url: '#pattern-ebc',
      icon: Settings2,
      section: 'settings',
    },
    {
      title: 'Admin Settings',
      url: '#admin-settings',
      icon: CheckCheck,
      section: 'settings',
      requiresAdmin: true,
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
  console.log(userData);
  const { isTestMode, setIsTestMode } = useAppMode();
  const { state } = useSidebar();
  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="top-8 h-[calc(100vh-32px)]"
    >
      <SidebarHeader>
        <div className="flex flex-col w-full">
          <TeamSwitcher teams={data.teams} />
          <div className={`${state === 'expanded' ? 'mt-3' : 'mt-2'}`}>
            {/* Expanded State - Full Toggle */}
            <div
              className={`overflow-hidden ${
                state === 'expanded'
                  ? 'max-h-16 opacity-100 mb-0'
                  : 'max-h-0 opacity-0 pointer-events-none mb-0'
              }`}
            >
              <div className="flex items-center justify-center px-2">
                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 w-full">
                  <button
                    className={`flex-1 py-2 rounded-md text-xs font-medium ${
                      !isTestMode
                        ? 'bg-green-500 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    onClick={() => setIsTestMode(false)}
                  >
                    Production
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-md text-xs font-medium ${
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

            {/* Collapsed State - Icon Only */}
            <div
              className={`flex items-center justify-center ${
                state !== 'expanded'
                  ? 'opacity-100 max-h-10'
                  : 'opacity-0 max-h-0 pointer-events-none'
              }`}
            >
              <button
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isTestMode
                    ? 'bg-yellow-500 text-gray-900 shadow-md hover:shadow-lg'
                    : 'bg-green-500 text-gray-900 shadow-md hover:shadow-lg'
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
