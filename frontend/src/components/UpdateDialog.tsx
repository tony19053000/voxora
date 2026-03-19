import { UpdateInfo } from '@/services/updateService';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
}

export function UpdateDialog({ open, onOpenChange, updateInfo }: UpdateDialogProps) {
  void open;
  void onOpenChange;
  void updateInfo;
  return null;
}
