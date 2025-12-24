import { Modal, Text, Group, Button } from '@mantine/core';

type ConfirmModalProps = {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title = 'Confirmar acción',
  message = '¿Estás seguro de realizar esta acción?',
  confirmLabel = 'Sí, eliminar',
  cancelLabel = 'Cancelar',
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text mb="md">{message}</Text>
      <Group style={{ display: 'flex', justifyContent: 'center' }} >
        <Button variant="outline" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button color="red" onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
