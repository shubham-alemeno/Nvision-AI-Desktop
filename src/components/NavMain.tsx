import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

interface NavMainProps {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
  onNavigate: (page: string) => void;
  activePage: string;
  userData?: {
    is_staff: boolean;
    is_superuser: boolean;
    is_active: boolean;
    username: string;
    email?: string;
  };
}

export function NavMain({
  items,
  onNavigate,
  activePage,
  userData,
}: NavMainProps) {
  // Helper to extract page key from url (e.g., '#pattern-EBC' => 'pattern-ebc')
  const getPageKey = (url: string) => url.replace(/^#/, '').toLowerCase();


const hasAdminPermissions = (userData: any): boolean => {
    if (!userData) return false;
    
    // Check if user is active
    if (!userData.is_active) return false;
    
    // Check if access_levels exists and has the required permissions
    const accessLevels = userData.access_levels;
    if (!accessLevels) return false;
    
    // User has admin permissions if they can both create users AND manage users via API
    return accessLevels.can_create_users && accessLevels.can_manage_users_api;
};

  // Filter navigation items based on permissions
  const getFilteredNavItems = () => {
    return items.map((item) => {
      if (item.title === 'App settings' && item.items) {
        // Filter sub-items for App settings
        const filteredSubItems = item.items.filter((subItem) => {
          if (subItem.title === 'Admin Settings') {
            return hasAdminPermissions(userData);
          }
          return true; // Show other sub-items
        });

        return {
          ...item,
          items: filteredSubItems,
        };
      }
      return item;
    });
  };

  const filteredItems = getFilteredNavItems();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {filteredItems.map((item) => {
          if (!item.items || item.items.length === 0) {
            const pageKey = getPageKey(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={activePage === pageKey}
                  onClick={() => onNavigate(pageKey)}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }
          // If item has subitems, render as collapsible
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={
                      activePage === getPageKey(item.url) ||
                      item.items.some(
                        (sub) => activePage === getPageKey(sub.url)
                      )
                    }
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const subPageKey = getPageKey(subItem.url);
                      return (
                        <SidebarMenuSubItem
                          key={subItem.title}
                          className="cursor-pointer"
                        >
                          <SidebarMenuSubButton
                            isActive={activePage === subPageKey}
                            onClick={() => onNavigate(subPageKey)}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
