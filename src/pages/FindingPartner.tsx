import { motion } from 'motion/react'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'

export default function FindingPartner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <ImageWithFallback src="/alyne-logo.png" alt="Alyne" className="w-24" />
        </motion.div>

        <div className="flex items-center justify-center py-4">
          <div className="relative h-[110px] w-[240px]">
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2"
              style={{ width: '58px', height: '64px' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: 1,
                x: 0,
                y: [0, -5, 0],
              }}
              transition={{
                opacity: { duration: 0.8, ease: 'easeOut' },
                x: { duration: 0.8, ease: 'easeOut' },
                y: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 1,
                },
              }}
            >
              <img src="/finding-asset-1.svg" alt="" className="h-full w-full" />
            </motion.div>

            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ width: '58px', height: '64px' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{
                opacity: 1,
                x: 0,
                y: [0, -5, 0],
              }}
              transition={{
                opacity: { duration: 0.8, ease: 'easeOut', delay: 0.2 },
                x: { duration: 0.8, ease: 'easeOut', delay: 0.2 },
                y: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 1.3,
                },
              }}
            >
              <img src="/finding-asset-2.svg" alt="" className="h-full w-full" />
            </motion.div>

            <svg
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              width="100"
              height="2"
              viewBox="0 0 100 2"
              aria-hidden
            >
              <motion.line
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="#d4b87a"
                strokeWidth="1"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: [1, 0.4, 1],
                }}
                transition={{
                  pathLength: { duration: 1.2, ease: 'easeOut', delay: 0.6 },
                  opacity: {
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1.5,
                  },
                }}
              />
            </svg>

            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              <div className="flex gap-1.5">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: '#d4b87a' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: '#d4b87a' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                />
                <motion.div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: '#d4b87a' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                />
              </div>
            </motion.div>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-2">
          <motion.h1
            className="text-[1.6rem] font-semibold leading-tight tracking-tight text-[#2b2b2b]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Finding your person
            <motion.span
              style={{ color: '#a8893f' }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            >
              .
            </motion.span>
          </motion.h1>

          <motion.p
            className="px-2 text-[0.95rem] leading-snug text-[#2b2b2b]/70"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            We&apos;re looking for someone with the same goal. We&apos;ll notify you the moment we
            find a match — usually within 24 hours.
          </motion.p>

          <motion.p
            className="pt-3 text-[0.95rem] font-medium italic"
            style={{ color: '#5e4513' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            Good things take a moment.
          </motion.p>
        </div>

      </div>
    </div>
  )
}
