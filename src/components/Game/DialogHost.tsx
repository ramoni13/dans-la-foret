// ============================================================
// DIALOG HOST — affiche les dialogues de `dialogStore` avec la modale `ConfirmModal` de l'app
//
// Monté UNE FOIS dans le layout racine. Remplace Alert.alert / window.alert / window.confirm.
// ============================================================

import React from 'react';

import { useT } from '../../i18n';
import { useDialogStore } from '../../store/dialogStore';
import { ConfirmModal } from './ConfirmModal';

export const DialogHost: React.FC = () => {
  const t = useT();
  const current = useDialogStore(s => s.current);
  const close = useDialogStore(s => s.close);

  if (!current) return null;

  const { alertOnly, destructive } = current;

  const handleConfirm = () => {
    close();
    current.onConfirm?.();
  };
  const handleCancel = () => {
    close();
    current.onCancel?.();
  };

  return (
    <ConfirmModal
      key={current.id}
      visible
      icon={current.icon ?? (alertOnly ? 'ℹ️' : '⚠️')}
      iconBg={alertOnly ? '#E3F2FD' : '#FFF3E0'}
      iconBorder={alertOnly ? '#BBDEFB' : '#FFE0B2'}
      borderColor={alertOnly ? '#1976D2' : '#FF9800'}
      title={current.title ?? ''}
      message={current.message}
      confirmLabel={current.confirmLabel ?? t(alertOnly ? 'dialog_ok' : 'dialog_confirm')}
      confirmDestructive={destructive}
      cancelLabel={current.cancelLabel ?? t('dialog_cancel')}
      hideCancel={alertOnly}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};
