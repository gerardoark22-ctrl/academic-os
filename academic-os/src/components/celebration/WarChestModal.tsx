import { motion } from 'framer-motion';
import { EpicButton } from '../ui';
import type { ChestReward } from '../../utils/cosmetics';
import { GERARDEX_SKINS } from '../../utils/cosmetics';

interface WarChestModalProps {
  open: boolean;
  reward: ChestReward | null;
  onClaim: () => void;
}

export function WarChestModal({ open, reward, onClaim }: WarChestModalProps) {
  if (!open || !reward) return null;

  const label =
    reward.type === 'xp'
      ? `+${reward.amount} XP`
      : reward.type === 'skin'
        ? `Skin: ${GERARDEX_SKINS.find((s) => s.id === reward.skinId)?.label ?? reward.skinId}`
        : `Título: ${reward.title}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-ink/85 p-4"
    >
      <motion.div
        initial={{ scale: 0.5, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        className="panel-epic max-w-sm p-8 text-center"
      >
        <motion.div
          animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-6xl"
        >
          🎁
        </motion.div>
        <h3 className="title-carved-lg mt-4 !text-xl text-gold-bright">Cofre de Guerra</h3>
        <p className="flavor-brutal mt-2">Gerardex encontró botín inesperado</p>
        <p className="stat-epic mt-4 text-2xl text-highlight">{label}</p>
        <EpicButton className="mt-6 w-full" onClick={onClaim}>RECLAMAR</EpicButton>
      </motion.div>
    </motion.div>
  );
}
