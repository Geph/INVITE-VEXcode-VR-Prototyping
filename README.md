# INVITE VEXcode VR Prototyping Sandbox
An AI-Assisted visual block-based programming environment designed for learning robotics and programming concepts. Built with Next.js and Google Blockly, this application provides an interactive way to program a virtual submarine robot to clean up ocean trash.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Powered by Blockly](https://img.shields.io/badge/Powered%20by-Blockly-4285F4?style=for-the-badge&logo=google)](https://developers.google.com/blockly)

## Overview

Ocean Cleanup is an educational programming environment where users drag and drop code blocks to control a submarine robot navigating an underwater scene. The robot collects floating trash while avoiding coral reef borders. An integrated AI Assistant helps learners develop problem-solving strategies and debug their code.

## Features

### Block-Based Programming
Visual programming using Google Blockly with seven categories of blocks:

| Category | Color | Description |
|----------|-------|-------------|
| **Drivetrain** | Blue | Movement controls: drive forward/reverse, turn, set velocity, heading, and rotation |
| **Logic** | Orange | Control flow: wait, repeat, forever loops, if/then/else, while, break |
| **Magnet** | Purple | Magnet controls for picking up objects |
| **Drawing** | Orange | Pen controls: move pen up/down, set width and color |
| **Sensing** | Teal | Sensors: bumper detection, distance sensors, eye sensors, position tracking |
| **Console** | Purple | Output: print text, cursor control, clear screen |
| **Switch** | Green | Functions: define and call custom functions, boolean operators |

### Ocean Cleanup Playground
- **Interactive Canvas**: Sandy ocean floor with colorful coral reef borders
- **Submarine Robot**: Cute yellow submarine with periscope that responds to block commands
- **Trash Collection**: Floating debris spawns randomly; collect it by driving into it
- **Collision Detection**: Hit the coral borders and receive a "Game Over" notification
- **Score Tracking**: Orange counter displays total trash collected
- **Rulers**: Measurement guides on bottom and right edges (in pixels)

### Custom Input Controls
- **Angle Wheel Picker**: Drag to set degrees for turn commands with visual pie-slice indicator
- **Compass Picker**: Cardinal direction compass (N/E/S/W) for heading commands
- **Distance Slider**: Slide to set distance with live preview line on the playground

### AI Assistant
An integrated help system with multiple support options:

1. **Come up with a strategy**
   - Move faster (efficiently)
   - Turn around at the edge
   - Find more blocks that could help you

2. **Fix something that's not working**
   - My robot won't move
   - My robot goes the wrong direction
   - My code runs but nothing happens
   - I'm getting an error

3. **Compare to a previous attempt**
   - What changed since last time?
   - Which version worked better?
   - Show me the differences

4. **Tell me how you feel**
   - I'm feeling stuck
   - I'm frustrated
   - I'm excited about my progress
   - I want to try something new

5. **Work with a partner**
   - Find a coding buddy
   - Share my code
   - Review someone's code

6. **Predict and Plan**
   - Preview the robot's path before running
   - Green line shows predicted trajectory based on current blocks
   - Helps visualize code execution

### Program Controls
- **Start**: Execute the block program
- **Reset**: Return robot to starting position
- **Open Playground**: Show/hide the Ocean Cleanup window
- **Get Help**: Open AI Assistant

### Workspace Features
- **"When Started" Block**: Always-present entry point block (cannot be deleted)
- **Trash/Undo**: View and restore recently deleted blocks
- **Draggable Windows**: Both Playground and AI Assistant windows can be repositioned
- **Minimize/Maximize**: Window size controls for Playground and AI Assistant
- **Zoom**: Mouse scroll to zoom the workspace

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/ocean-cleanup-blocks.git

# Navigate to project directory
cd ocean-cleanup-blocks

# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Usage Guide

### Basic Robot Movement
1. Find the **Drivetrain** category in the left sidebar
2. Drag a "drive forward for 200 mm" block to the workspace
3. Connect it below the "when started" block
4. Click **Start** to watch the robot move

### Collecting Trash
1. Click **Start** to begin spawning trash
2. Program the robot to navigate toward trash items
3. When the robot touches trash, it disappears and your score increases

### Using the AI Assistant
1. Click the pink **Get Help** button in the top bar
2. Select from the help categories based on your needs
3. Use **Predict and Plan** to visualize your code before running

### Custom Angle Input
- Click on a number field in turn blocks to open the angle wheel
- Drag around the wheel to set precise degrees
- For heading blocks, use the compass with cardinal directions

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Block Editor**: Google Blockly
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Language**: TypeScript

## Project Structure

\`\`\`
├── app/
│   ├── page.tsx          # Main application component
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   └── ui/               # Reusable UI components
├── lib/
│   └── utils.ts          # Utility functions
└── public/               # Static assets
\`\`\`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Google Blockly](https://developers.google.com/blockly) for the block-based programming framework
- [VEXcode VR](https://vr.vex.com/) for design inspiration
- [Vercel](https://vercel.com) for hosting and deployment

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/your-username/ocean-cleanup-blocks/issues) on GitHub.
