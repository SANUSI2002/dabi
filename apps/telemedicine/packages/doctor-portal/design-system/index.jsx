import React from "react";
import { motion } from "framer-motion";
export function PageTransition({ children, ...props }) { return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }} {...props}>{children}</motion.div>; }
export function StaggerGroup({ children, ...props }) { return <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: .06 } } }} {...props}>{children}</motion.div>; }
export function StaggerItem({ children, ...props }) { return <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} {...props}>{children}</motion.div>; }
