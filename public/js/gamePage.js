import { Coord, crd } from "../../lib/coord.js";
import Grid from "../../lib/grid.js";

const COLOURS = {
    gridLines: "darkgrey",
    gridBackground: "black",

    normalPlayerBorder: "darkgreen",
    loggedInPlayerBorder: "lime",
    winnerBorder: "magenta",
    normalPlayerBackground: "black",
    loggedInPlayerBackground: "black",
    winnerBackground: "rgb(50, 0, 50)",

    normalName: "white",
    winnerName: "yellow",

    hpStat: "red",
    apStat: "lime",
    rangeStat: "orange",

    thisPlayerRangeBorder: "orange",
    thisPlayerRangeFill: "rgb(255, 165, 0, 0.2)", /// "orange" with opacity
    selPlayerRangeBorder: "maroon",
    selPlayerRangeFill: "rgb(128, 0, 0, 0.2)", /// "maroon" with opacity

    reachableSquareFill: "rgb(0, 0, 255, 0.3)",
    selctedSquareBorder: "yellow",

    currentVote: "rgb(100, 100, 255, 0.7)",
    hasntVoted: "rgb(255, 0, 0, 0.7)"
}

let ws = null;
/**
 * @type {CanvasRenderingContext2D}
*/
let ctx = null;
let width = null, height = null;
let canvasX = null, canvasY = null;

let currState = null;

let originX = null, originY = null;
let squareSide = null, gridSide = null;
let dim = null;
let zoomLevel = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

let selectedSquare = null;
let distsFromPlayer = null;
// Store barrel rotation angle for each player
let playerBarrelAngles = {};

let errorModalOKFunction = null;

function boundOrigin() {
    if (gridSide > width) {
        if (originX > 0) { originX = 0; }
        if (originX + gridSide < width) { originX = width - gridSide; }
    } else {
        originX = width / 2 - gridSide / 2;
    }
    if (gridSide > height) {
        if (originY > 0) { originY = 0; }
        if (originY + gridSide < height) { originY = height - gridSide; }
    } else {
        originY = height / 2 - gridSide / 2;
    }
}

function centerCoordinates(pos) {
    originX = width / 2 - (pos.c * squareSide) - squareSide / 2;
    originY = height / 2 - (pos.r * squareSide) - squareSide / 2;

    boundOrigin();
}

function setup() { /// drawing setup, name borrowed from p5.js
    let { x: cx, y: cy } = ctx.canvas.getBoundingClientRect();
    canvasX = cx;
    canvasY = cy;

    // Make squares a bit larger for better tank visibility
    squareSide = Math.max(Math.min(width / dim, height / dim), 60) * zoomLevel;
    gridSide = squareSide * dim;

    if (loggedInUname && currState.players[loggedInUname].hp > 0) {
        let playerPos = currState.players[loggedInUname].pos;
        centerCoordinates(playerPos);

        distsFromPlayer = currState.grid.getDistsFromPos(playerPos);
    } else {
        let avgR = 0, avgC = 0, aliveCount = 0;
        for (const p in currState.players) {
            if (currState.players[p].pos != null) {
                avgR += currState.players[p].pos.r;
                avgC += currState.players[p].pos.c;
                aliveCount++;
            }
        }
        avgR /= aliveCount;
        avgC /= aliveCount
        centerCoordinates(new Coord(Math.round(avgR), Math.round(avgC)));
    }

    document.querySelector("button#modalAttackButton").addEventListener("click", attackModalSubmitted);
    document.querySelector("button#modalGiveButton").addEventListener("click", giveModalSubmitted);
    document.querySelector("button#modalUpgradeButton").addEventListener("click", upgradeModalSubmitted);
}

function drawPlayer(p, isSelected = false) {
    // Get player position (actual position or animated position)
    let playerAnimation = animatedPlayers.get(p.name);
    let barrelAnimation = animatedBarrels.get(p.name);
    let x, y;

    if (playerAnimation) {
        // Use animated position
        x = playerAnimation.currentX;
        y = playerAnimation.currentY;
    } else {
        // Use regular position from grid
        x = originX + p.pos.c * squareSide;
        y = originY + p.pos.r * squareSide;
    }

    // Determine which tank to draw based on player
    let tankIndex;

    // Other players get different colored tanks based on name hash
    const hash = p.name.split("").reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);

    const options = ["red", "dark", "green", "sand"];
    tankIndex = options[Math.abs(hash) % options.length];

    if (p.name === "Redstoyn33") {
        tankIndex = options[0];
    }

    const tankBody = IMAGES.tanks[tankIndex];
    const tankBarrel = IMAGES.barrels[tankIndex];

    // Calculate tank dimensions (make it slightly smaller than the cell)
    const SCALE = 0.85; // Scale factor for the tank
    const tankWidth = squareSide * SCALE;
    const tankHeight = tankWidth * (tankBody.height / tankBody.width);

    // Center of tank/cell for rotation
    const centerX = x + squareSide / 2;
    const centerY = y + squareSide / 2;

    // Center the tank in the cell
    const tankX = x + (squareSide - tankWidth) / 2;
    const tankY = y + (squareSide - tankHeight) / 2;

    const tankOutline = IMAGES.tanksOutline[tankIndex];

    // Draw tank body
    ctx.drawImage(tankBody, tankX, tankY, tankWidth, tankHeight);

    // Draw tank outline
    ctx.drawImage(tankOutline, tankX, tankY, tankWidth, tankHeight);

    // Calculate barrel dimensions and position
    const barrelWidth = tankWidth * 0.3;
    const barrelHeight = tankHeight * 0.8;

    // Determine barrel angle - point to selected square or use saved angle
    let barrelAngle;
    if (barrelAnimation) {
        barrelAngle = barrelAnimation.currentAngle + Math.PI / 2;
    }
    else if (p.name in playerBarrelAngles) {
        barrelAngle = playerBarrelAngles[p.name] + Math.PI / 2;
    } else {
        barrelAngle = -Math.PI / 2; // Default pointing up
    }

    // Save context for barrel rotation
    ctx.save();

    // Translate to center of tank (pivot point for rotation)
    ctx.translate(tankX + tankWidth / 2, tankY + tankHeight / 2);

    // Rotate to point in proper direction
    ctx.rotate(barrelAngle);

    // Get barrel outline
    const barrelOutline = IMAGES.barrelsOutline[tankIndex];

    // Draw barrel (adjusting position to account for rotation around center)
    ctx.drawImage(
        tankBarrel,
        -barrelWidth / 2,
        -barrelHeight / 2 - tankHeight / 3, // Position barrel at top of tank
        barrelWidth,
        barrelHeight
    );

    // Draw barrel outline
    ctx.drawImage(
        barrelOutline,
        -barrelWidth / 2,
        -barrelHeight / 2 - tankHeight / 3, // Position barrel at top of tank
        barrelWidth,
        barrelHeight
    );

    // Restore context after barrel drawing
    ctx.restore();

    // Draw player name
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    ctx.font = "10px 'Consolas', monospace";
    ctx.textBaseline = "top";

    if (gameState === "post-game" && currState.winner === p.name) {
        ctx.fillStyle = COLOURS.winnerName;
        ctx.lineWidth = 2;
    } else {
        ctx.fillStyle = COLOURS.normalName;
    }

    let name = p.name;
    if (gameState === "post-game" && currState.winner === p.name) {
        name = `👑${p.name}👑`;
    }

    // Handle long names
    const NAME_CUTOFF = 10;
    if (name.length > NAME_CUTOFF) {
        let arr = name.split('');
        arr.splice(Math.floor(name.length / 2), 0, '\n');
        name = arr.join('');
    }

    // Draw name with background for better visibility
    if (zoomLevel > 0.7) {
        name = name.split('\n');
        for (let i = 0; i < name.length; i++) {
            const textY = y + 3 + 10 * i;

            // Text background for better visibility
            const textWidth = ctx.measureText(name[i]).width;
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(x + squareSide / 2 - textWidth / 2 - 2, textY - 1, textWidth + 4, 12);

            // Text itself
            ctx.fillStyle = (gameState === "post-game" && currState.winner === p.name) ?
                COLOURS.winnerName : COLOURS.normalName;
            ctx.fillText(name[i], x + squareSide / 2, textY, squareSide);
        }

        // Draw stats (HP, AP, Range) with background
        const MARGIN = 3;
        const statsY = y + squareSide - MARGIN;

        ctx.textBaseline = "bottom";

        // Stats background
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(x + MARGIN, statsY - 10, squareSide - MARGIN * 2, 12);

        // HP (left)
        ctx.fillStyle = COLOURS.hpStat;
        ctx.textAlign = "left";
        ctx.fillText(`${p.hp}`, x + MARGIN + 2, statsY, squareSide);

        // AP (center)
        ctx.fillStyle = COLOURS.apStat;
        ctx.textAlign = "center";
        ctx.fillText(`${p.ap}`, x + squareSide / 2, statsY, squareSide);

        // Range (right)
        ctx.fillStyle = COLOURS.rangeStat;
        ctx.textAlign = "right";
        ctx.fillText(`${p.range}`, x + squareSide - MARGIN - 2, statsY, squareSide);
    }
}

const ui = document.querySelector("div.clickedSquareUi");

function drawSelectedUi() {
    if (!loggedInUname || selectedSquare == null || ui.style.display == "") { return; }

    const dialogWidth = ui.clientWidth;
    const dialogHeight = ui.clientHeight;

    let x = originX + selectedSquare.c * squareSide + squareSide / 2 - dialogWidth / 2;
    if (x < 0) { x = originX + selectedSquare.c * squareSide; }
    else if (x + dialogWidth >= width) { x = originX + selectedSquare.c * squareSide + squareSide - dialogWidth; }
    // if(x < 5){ x = 5; }
    // else if(x + dialogWidth >= width-5){ x = width - dialogWidth - 5; }
    let y = originY + selectedSquare.r * squareSide - dialogHeight - 5;
    if (y <= 0) {
        y = originY + selectedSquare.r * squareSide + squareSide + 5;
    }

    ui.style.left = x + "px";
    ui.style.top = y + "px";
}

// Create track mark effect
function createTrackMark(startPos, endPos) {
    // Create fading track marks between start and end positions
    const startX = originX + startPos.c * squareSide + squareSide / 2;
    const startY = originY + startPos.r * squareSide + squareSide / 2;
    const endX = originX + endPos.c * squareSide + squareSide / 2;
    const endY = originY + endPos.r * squareSide + squareSide / 2;

    // Calculate angle between start and end positions
    const angle = Math.atan2(endY - startY, endX - startX);

    // Create track segments along the path
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const numSegments = Math.max(1, Math.floor(distance / (squareSide * 0.5)));

    for (let i = 0; i <= numSegments; i++) {
        const progress = i / numSegments;
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;

        tracksArray.push({
            x: x,
            y: y,
            angle: angle,
            opacity: 1.0,
            createdAt: Date.now()
        });
    }
}

// Create shooting effect
function createShootingEffect(playerName, targetPos) {
    const playerPos = currState.players[playerName].pos;
    
    // Calculate position - use animated position if available
    let x, y;
    const playerAnimation = animatedPlayers.get(playerName);
    
    if (playerAnimation) {
        // Use current animated position
        x = playerAnimation.currentX + squareSide / 2;
        y = playerAnimation.currentY + squareSide / 2;
    } else {
        // Use grid position
        x = originX + playerPos.c * squareSide + squareSide / 2;
        y = originY + playerPos.r * squareSide + squareSide / 2;
    }

    // Calculate angle from player to target
    const dx = targetPos.c - playerPos.c;
    const dy = targetPos.r - playerPos.r;
    const direction = Math.atan2(dy, dx);

    // Update the player's barrel angle with animation
    const currentAngle = playerBarrelAngles[playerName] || 0;
    startBarrelRotationAnimation(playerName, currentAngle, direction);
    playerBarrelAngles[playerName] = direction;

    // Add shooting effect
    shootingEffects.push({
        x: x,
        y: y,
        direction: direction,
        scale: 0, // Start small and grow
        createdAt: Date.now(),
        opacity: 1.0
    });
    
    // Start animation loop if needed
    if (!animationLoopRunning) {
        animationLoop();
    }
}

// Draw track marks
function drawTrackMarks() {
    const TRACK_LIFETIME = 5000; // 5 seconds lifetime
    const currentTime = Date.now();
    const tracksToKeep = [];

    // Draw all active track marks and filter out old ones
    for (const track of tracksArray) {
        const age = currentTime - track.createdAt;

        if (age <= TRACK_LIFETIME) {
            // Calculate fading opacity based on age
            track.opacity = 1 - (age / TRACK_LIFETIME);

            // Draw track mark
            ctx.save();
            ctx.globalAlpha = track.opacity;
            ctx.translate(track.x, track.y);
            ctx.rotate(track.angle);

            const trackWidth = squareSide * 0.4;
            const trackHeight = squareSide * 0.2;

            ctx.drawImage(
                IMAGES.effects.tracks,
                -trackWidth / 2,
                -trackHeight / 2,
                trackWidth,
                trackHeight
            );

            ctx.restore();

            tracksToKeep.push(track);
        }
    }

    // Update the tracksArray to only keep active tracks
    tracksArray = tracksToKeep;
}

// Draw shooting effects
function drawShootingEffects() {
    const EFFECT_LIFETIME = 1000; // 1 second lifetime
    const currentTime = Date.now();
    const effectsToKeep = [];

    for (const effect of shootingEffects) {
        const age = currentTime - effect.createdAt;

        if (age <= EFFECT_LIFETIME) {
            // Calculate animation progress
            const progress = age / EFFECT_LIFETIME;
            effect.scale = Math.sin(progress * Math.PI) * 0.5; // Grow and shrink
            effect.opacity = 1 - (age / EFFECT_LIFETIME);

            // Draw explosion effect
            ctx.save();
            ctx.globalAlpha = effect.opacity;
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.direction);

            // Move explosion to end of barrel
            const distance = squareSide * 0.5;
            ctx.translate(0, -distance);

            const effectSize = squareSide * 0.4 * effect.scale;

            ctx.drawImage(
                IMAGES.effects.explosion,
                -effectSize / 2,
                -effectSize / 2,
                effectSize,
                effectSize
            );

            ctx.restore();

            effectsToKeep.push(effect);
        }
    }
    // Update to only keep active effects
    shootingEffects = effectsToKeep;
}

function startBarrelRotationAnimation(playerName, startAngle, endAngle) {
    const ANIMATION_DURATION = 300; // Reduced duration for faster rotation
    
    // If there's an existing animation for this player, start from its current angle
    if (animatedBarrels.has(playerName)) {
        startAngle = animatedBarrels.get(playerName).currentAngle;
    }
    
    // Normalize angles to between -π and π
    while (startAngle > Math.PI) startAngle -= 2 * Math.PI;
    while (startAngle < -Math.PI) startAngle += 2 * Math.PI;
    while (endAngle > Math.PI) endAngle -= 2 * Math.PI;
    while (endAngle < -Math.PI) endAngle += 2 * Math.PI;
    
    // Calculate angular distance in both directions (clockwise and counterclockwise)
    let clockwiseDist = endAngle - startAngle;
    if (clockwiseDist < 0) clockwiseDist += 2 * Math.PI;
    
    let counterClockwiseDist = startAngle - endAngle;
    if (counterClockwiseDist < 0) counterClockwiseDist += 2 * Math.PI;
    
    // Choose the shorter rotation direction
    let finalEndAngle;
    if (clockwiseDist <= counterClockwiseDist) {
        // Clockwise is shorter (or equal)
        if (endAngle < startAngle) {
            // We need to go over the boundary
            finalEndAngle = endAngle + 2 * Math.PI;
        } else {
            finalEndAngle = endAngle;
        }
    } else {
        // Counter-clockwise is shorter
        if (endAngle > startAngle) {
            // We need to go over the boundary
            finalEndAngle = endAngle - 2 * Math.PI;
        } else {
            finalEndAngle = endAngle;
        }
    }
    
    animatedBarrels.set(playerName, {
        startAngle,
        endAngle: finalEndAngle,
        currentAngle: startAngle,
        startTime: Date.now(),
        duration: ANIMATION_DURATION
    });
    
    // Only trigger animation loop if not already running
    if (!animationLoopRunning) {
        animationLoop();
    }
}

function updateBarrelAnimations() {
    const currentTime = Date.now();
    const playersToRemove = [];

    // Update each animated barrel
    for (const [playerName, animation] of animatedBarrels.entries()) {
        const elapsed = currentTime - animation.startTime;
        const progress = Math.min(1, elapsed / animation.duration);

        if (progress < 1) {
            // Use simpler linear interpolation for better performance
            animation.currentAngle = animation.startAngle + (animation.endAngle - animation.startAngle) * progress;
        } else {
            // Animation complete - update the final angle in playerBarrelAngles
            playerBarrelAngles[playerName] = animation.endAngle;
            playersToRemove.push(playerName);
        }
    }

    // Remove completed animations
    for (const player of playersToRemove) {
        animatedBarrels.delete(player);
    }
}

// Add animation for moving tanks
function startMoveAnimation(playerName, startPos, endPos) {
    // Animation duration in milliseconds - make enemy tanks move slightly faster
    const ANIMATION_DURATION = playerName === loggedInUname ? 800 : 600;
    
    // If there's an existing animation for this player, cancel it and start from current position
    if (animatedPlayers.has(playerName)) {
        const currentAnim = animatedPlayers.get(playerName);
        
        // Use the current animated position as the new start position
        const startX = currentAnim.currentX;
        const startY = currentAnim.currentY;
        const endX = originX + endPos.c * squareSide;
        const endY = originY + endPos.r * squareSide;
        
        // Create updated animation object
        animatedPlayers.set(playerName, {
            startX,
            startY,
            endX,
            endY,
            currentX: startX,
            currentY: startY,
            startTime: Date.now(),
            duration: ANIMATION_DURATION
        });
    } else {
        // Calculate start and end screen positions
        const startX = originX + startPos.c * squareSide;
        const startY = originY + startPos.r * squareSide;
        const endX = originX + endPos.c * squareSide;
        const endY = originY + endPos.r * squareSide;
        
        // Create animation object
        animatedPlayers.set(playerName, {
            startX,
            startY,
            endX,
            endY,
            currentX: startX,
            currentY: startY,
            startTime: Date.now(),
            duration: ANIMATION_DURATION
        });
    }
    
    // Create track marks for the movement
    createTrackMark(startPos, endPos);
    
    // Schedule animation updates if not already running
    if (!animationLoopRunning) {
        animationLoop();
    }
}

// Update animations
function updateAnimations() {
    const currentTime = Date.now();
    const playersToRemove = [];

    // Update each animated player
    for (const [playerName, animation] of animatedPlayers.entries()) {
        const elapsed = currentTime - animation.startTime;
        const progress = Math.min(1, elapsed / animation.duration);

        if (progress < 1) {
            // Use simpler, more efficient animation
            animation.currentX = animation.startX + (animation.endX - animation.startX) * progress;
            animation.currentY = animation.startY + (animation.endY - animation.startY) * progress;
        } else {
            // Animation complete
            playersToRemove.push(playerName);
        }
    }

    // Remove completed animations
    for (const player of playersToRemove) {
        animatedPlayers.delete(player);
    }
}

// Track if animation loop is currently running
let animationLoopRunning = false;
let animationFrameId = null;

// Animation loop with performance optimization
function animationLoop() {
    animationLoopRunning = true;
    
    updateBarrelAnimations();
    updateAnimations();
    draw();
    
    // Continue animation loop if there are active animations
    if (animatedBarrels.size > 0 || animatedPlayers.size > 0 || tracksArray.length > 0 || shootingEffects.length > 0) {
        animationFrameId = requestAnimationFrame(animationLoop);
    } else {
        // No more animations, stop the loop
        animationLoopRunning = false;
        animationFrameId = null;
    }
}

const tileMap = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];


// Cache rendered background to improve performance
let backgroundCache = null;
let lastZoomLevel = null;
let lastOriginX = null;
let lastOriginY = null;

// Function to create and cache background
function createBackgroundCache() {
    // Create an off-screen canvas for the background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    
    // Draw background color
    bgCtx.fillStyle = COLOURS.gridBackground;
    bgCtx.fillRect(0, 0, width, height);
    
    // Draw tiles
    for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim; c++) {
            const x = originX + c * squareSide;
            const y = originY + r * squareSide;
            
            // Check if tile is visible (for performance)
            if (x + squareSide < 0 || x > width || y + squareSide < 0 || y > height) {
                continue; // Skip tiles that are off-screen
            }

            let tileImage;
            switch (tileMap[r][c]) {
                // Grass tiles
                case 0: tileImage = IMAGES.tiles.grass1; break;
                case 1: tileImage = IMAGES.tiles.grass2; break;
                case 2: tileImage = IMAGES.tiles.grass_roadCornerLL; break;
                case 3: tileImage = IMAGES.tiles.grass_roadCornerLR; break;
                case 4: tileImage = IMAGES.tiles.grass_roadCornerUL; break;
                case 5: tileImage = IMAGES.tiles.grass_roadCornerUR; break;
                case 6: tileImage = IMAGES.tiles.grass_roadCrossing; break;
                case 7: tileImage = IMAGES.tiles.grass_roadCrossingRound; break;
                case 8: tileImage = IMAGES.tiles.grass_roadEast; break;
                case 9: tileImage = IMAGES.tiles.grass_roadNorth; break;
                case 10: tileImage = IMAGES.tiles.grass_roadSplitE; break;
                case 11: tileImage = IMAGES.tiles.grass_roadSplitN; break;
                case 12: tileImage = IMAGES.tiles.grass_roadSplitS; break;
                case 13: tileImage = IMAGES.tiles.grass_roadSplitW; break;
                case 14: tileImage = IMAGES.tiles.grass_roadTransitionE_dirt; break;
                case 15: tileImage = IMAGES.tiles.grass_roadTransitionE; break;
                case 16: tileImage = IMAGES.tiles.grass_roadTransitionN_dirt; break;
                case 17: tileImage = IMAGES.tiles.grass_roadTransitionN; break;
                case 18: tileImage = IMAGES.tiles.grass_roadTransitionS_dirt; break;
                case 19: tileImage = IMAGES.tiles.grass_roadTransitionS; break;
                case 20: tileImage = IMAGES.tiles.grass_roadTransitionW_dirt; break;
                case 21: tileImage = IMAGES.tiles.grass_roadTransitionW; break;
                case 22: tileImage = IMAGES.tiles.grass_transitionE; break;
                case 23: tileImage = IMAGES.tiles.grass_transitionN; break;
                case 24: tileImage = IMAGES.tiles.grass_transitionS; break;
                case 25: tileImage = IMAGES.tiles.grass_transitionW; break;
                
                // Sand tiles
                case 26: tileImage = IMAGES.tiles.sand1; break;
                case 27: tileImage = IMAGES.tiles.sand2; break;
                case 28: tileImage = IMAGES.tiles.sand_roadCornerLL; break;
                case 29: tileImage = IMAGES.tiles.sand_roadCornerLR; break;
                case 30: tileImage = IMAGES.tiles.sand_roadCornerUL; break;
                case 31: tileImage = IMAGES.tiles.sand_roadCornerUR; break;
                case 32: tileImage = IMAGES.tiles.sand_roadCrossing; break;
                case 33: tileImage = IMAGES.tiles.sand_roadCrossingRound; break;
                case 34: tileImage = IMAGES.tiles.sand_roadEast; break;
                case 35: tileImage = IMAGES.tiles.sand_roadNorth; break;
                case 36: tileImage = IMAGES.tiles.sand_roadSplitE; break;
                case 37: tileImage = IMAGES.tiles.sand_roadSplitN; break;
                case 38: tileImage = IMAGES.tiles.sand_roadSplitS; break;
                case 39: tileImage = IMAGES.tiles.sand_roadSplitW; break;
                
                // Default to grass1 if the tile type is unknown
                default: tileImage = IMAGES.tiles.grass1; break;
            }
            
            // Draw the tile image
            bgCtx.drawImage(tileImage, x, y, squareSide, squareSide);
        }
    }
    
    return bgCanvas;
}

function draw() {
    // Check if we need to recreate the background cache
    if (!backgroundCache || 
        lastZoomLevel !== zoomLevel || 
        lastOriginX !== originX || 
        lastOriginY !== originY) {
        
        backgroundCache = createBackgroundCache();
        lastZoomLevel = zoomLevel;
        lastOriginX = originX;
        lastOriginY = originY;
    }
    
    // Draw the cached background
    ctx.drawImage(backgroundCache, 0, 0);
    
    // Continue with the rest of the drawing

    // Draw track marks from tank movements
    drawTrackMarks();

    // Draw grid lines
    ctx.strokeStyle = COLOURS.gridLines;
    ctx.lineWidth = 0.5; // Thinner grid lines
    ctx.globalAlpha = 0.3; // More transparent grid lines

    for (let i = 0; i <= dim; i++) {
        ctx.beginPath();
        ctx.moveTo(originX + i * squareSide, originY);
        ctx.lineTo(originX + i * squareSide, originY + gridSide);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(originX, originY + i * squareSide);
        ctx.lineTo(originX + gridSide, originY + i * squareSide);
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0; // Reset transparency

    // Draw shooting effects
    drawShootingEffects();

    if (loggedInUname && currState.players[loggedInUname].hp > 0) { /// highlight the player's range
        let playerPos = currState.players[loggedInUname].pos;
        let playerRange = currState.players[loggedInUname].range;

        ctx.strokeStyle = COLOURS.thisPlayerRangeBorder;
        ctx.lineWidth = 2;
        ctx.fillStyle = COLOURS.thisPlayerRangeFill;
        ctx.beginPath();
        ctx.rect(
            originX + (playerPos.c - playerRange) * squareSide,
            originY + (playerPos.r - playerRange) * squareSide,
            squareSide * (playerRange * 2 + 1),
            squareSide * (playerRange * 2 + 1)
        );
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
    }
    /// highlight the selected player's range
    if (selectedSquare && currState.grid[selectedSquare] != null && currState.grid[selectedSquare] != loggedInUname) {
        let playerPos = currState.players[currState.grid[selectedSquare]].pos;
        let playerRange = currState.players[currState.grid[selectedSquare]].range;

        ctx.strokeStyle = COLOURS.selPlayerRangeBorder;
        ctx.lineWidth = 2;
        ctx.fillStyle = COLOURS.selPlayerRangeFill;
        ctx.beginPath();
        ctx.rect(
            originX + (playerPos.c - playerRange) * squareSide,
            originY + (playerPos.r - playerRange) * squareSide,
            squareSide * (playerRange * 2 + 1),
            squareSide * (playerRange * 2 + 1)
        );
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
    }

    for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim; c++) {
            let x = originX + c * squareSide, y = originY + r * squareSide;
            if (loggedInUname && currState.players[loggedInUname].hp > 0) {
                /// highlight reachable
                if ((distsFromPlayer[r][c] <= currState.players[loggedInUname].ap)) {
                    ctx.fillStyle = COLOURS.reachableSquareFill;
                    ctx.fillRect(x, y, squareSide, squareSide);
                }
            }

            // If this cell has a player
            if (currState.grid[r][c] != null) {
                const p = currState.players[currState.grid[r][c]];
                if (p.hp > 0) {
                    // Check if this cell is selected
                    const isSelected = selectedSquare != null &&
                        selectedSquare.r == r &&
                        selectedSquare.c == c;

                    // Draw the player with rotation if selected
                    drawPlayer(p, isSelected);
                }
            }

            // Highlight selected square
            if (selectedSquare != null && selectedSquare.r == r && selectedSquare.c == c) {
                ctx.strokeStyle = COLOURS.selctedSquareBorder;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, squareSide, squareSide);

                // Add a glow effect
                ctx.shadowColor = COLOURS.selctedSquareBorder;
                ctx.shadowBlur = 15;
                ctx.strokeRect(x, y, squareSide, squareSide);
                ctx.shadowBlur = 0;
            }
        }
    }

    if (gameState == "in-game" && loggedInUname && currState.players[loggedInUname].hp <= 0) {
        let vote = currState.players[loggedInUname].vote;
        let text;
        if (vote == null) {
            text = `YOU HAVEN'T VOTED`;
            ctx.fillStyle = COLOURS.hasntVoted;
        } else {
            text = `CURRENT VOTE: ${vote}`;
            ctx.fillStyle = COLOURS.currentVote;
        }
        ctx.lineWidth = 1;
        ctx.font = "30px 'Consolas', monospace";
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        ctx.fillText(text, width / 2, 5, width);
    }

    drawSelectedUi();
}

function updateSelectedMenu() {
    if (selectedSquare && loggedInUname && gameState == "in-game") {
        const imAlive = (currState.players[loggedInUname].hp > 0);
        const selSqOccupied = (currState.grid[selectedSquare] != null);
        const selSqIsMe = (currState.grid[selectedSquare] == loggedInUname);
        const selSqIsOtherPlayer = (selSqOccupied && currState.grid[selectedSquare] != loggedInUname);
        const selSqInRange = (imAlive && Coord.ringDist(selectedSquare, currState.players[loggedInUname].pos) <= currState.players[loggedInUname].range);
        const selSqReachable = (imAlive && distsFromPlayer[selectedSquare] <= currState.players[loggedInUname].ap);
        const ap = currState.players[loggedInUname].ap;

        let allDisabled = true;
        allDisabled &= ui.querySelector("button#moveButton").disabled = !(selSqReachable && !selSqOccupied && imAlive);
        allDisabled &= ui.querySelector("button#attackButton").disabled = !(selSqInRange && selSqIsOtherPlayer && (ap >= 1) && imAlive);
        allDisabled &= ui.querySelector("button#giveButton").disabled = !(selSqInRange && selSqIsOtherPlayer && (ap >= 1) && imAlive);
        allDisabled &= ui.querySelector("button#upgradeButton").disabled = !(selSqIsMe && (ap >= 2) && imAlive);
        allDisabled &= ui.querySelector("button#voteButton").disabled = !(selSqIsOtherPlayer && !imAlive);
        ui.style.display = (allDisabled ? "" : "block");

        if (!ui.querySelector("button#voteButton").disabled) {
            if (currState.players[loggedInUname].vote == currState.grid[selectedSquare]) {
                ui.querySelector("button#voteButton").innerHTML = "❎";
            } else {
                ui.querySelector("button#voteButton").innerHTML = "✅";
            }
        }
    } else {
        ui.querySelector("button#moveButton").disabled = true;
        ui.querySelector("button#attackButton").disabled = true;
        ui.querySelector("button#giveButton").disabled = true;
        ui.querySelector("button#upgradeButton").disabled = true;
        ui.querySelector("button#voteButton").disabled = true;
        ui.style.display = "";
    }
}

// Debounce function to limit how often clicks are processed
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Throttle function to limit rate of function calls
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Track last click time to prevent rapid clicks
let lastClickTime = 0;
const CLICK_THROTTLE_MS = 100; // Minimum ms between clicks

function handleClick(cx, cy) {
    // Throttle clicks to prevent lag from rapid firing
    const now = Date.now();
    if (now - lastClickTime < CLICK_THROTTLE_MS) {
        return; // Ignore clicks that are too close together
    }
    lastClickTime = now;

    const x = cx - originX, y = cy - originY;
    let pos = new Coord(Math.floor(y / squareSide), Math.floor(x / squareSide));

    // Handle selection toggling first for responsiveness
    const wasSelected = (selectedSquare != null && selectedSquare.equals(pos));
    if (wasSelected) {
        selectedSquare = null;
    } else {
        selectedSquare = pos;
        
        // If this is a new selection (not deselecting)
        // If logged in player exists and is alive
        if (loggedInUname && currState.players[loggedInUname].hp > 0) {
            const playerPos = currState.players[loggedInUname].pos;

            // Calculate angle from player to selected tile
            const dx = pos.c - playerPos.c;
            const dy = pos.r - playerPos.r;
            const angle = Math.atan2(dy, dx);

            // Only animate if angle changed significantly
            const currentAngle = playerBarrelAngles[loggedInUname] || 0;
            if (Math.abs(currentAngle - angle) > 0.1) {
                startBarrelRotationAnimation(loggedInUname, currentAngle, angle);
                playerBarrelAngles[loggedInUname] = angle;
            }
        }

        // Also calculate angles for any player if their tile is selected
        if (currState.grid[pos] != null) {
            const selectedPlayerName = currState.grid[pos];
            const selectedPlayerPos = currState.players[selectedPlayerName].pos;

            // For other players, make them point at the current player
            if (loggedInUname && selectedPlayerName != loggedInUname &&
                currState.players[loggedInUname].hp > 0) {

                const playerPos = currState.players[loggedInUname].pos;
                const dx = playerPos.c - selectedPlayerPos.c;
                const dy = playerPos.r - selectedPlayerPos.r;
                const angle = Math.atan2(dy, dx);

                // Only animate if angle changed significantly
                const currentAngle = playerBarrelAngles[selectedPlayerName] || 0;
                if (Math.abs(currentAngle - angle) > 0.1) {
                    startBarrelRotationAnimation(selectedPlayerName, currentAngle, angle);
                    playerBarrelAngles[selectedPlayerName] = angle;
                }
            }
        }
    }
    
    updateSelectedMenu();
    
    // Force a redraw to show selection immediately
    draw();
}

let panStartCoords = null;
let panOffset = null, originBeforePan = null;
let panningTouch = null;
let pinchStartDistance = null;
let zoomStartLevel = null;
let pinchTouches = null;
let pinchCenterStart = null;

// Tank and tile images
const IMAGES = {
    tanks: {
        blue: null,
        green: null,
        red: null,
        dark: null,
        sand: null
    },
    tanksOutline: {
        blue: null,
        green: null,
        red: null,
        dark: null,
        sand: null
    },
    barrels: {
        blue: null,
        green: null,
        red: null,
        dark: null,
        sand: null
    },
    barrelsOutline: {
        blue: null,
        green: null,
        red: null,
        dark: null,
        sand: null
    },
    tiles: {
        grass1: null,
        grass2: null,
        grass_roadCornerLL: null,
        grass_roadCornerLR: null,
        grass_roadCornerUL: null,
        grass_roadCornerUR: null,
        grass_roadCrossing: null,
        grass_roadCrossingRound: null,
        grass_roadEast: null,
        grass_roadNorth: null,
        grass_roadSplitE: null,
        grass_roadSplitN: null,
        grass_roadSplitS: null,
        grass_roadSplitW: null,
        grass_roadTransitionE_dirt: null,
        grass_roadTransitionE: null,
        grass_roadTransitionN_dirt: null,
        grass_roadTransitionN: null,
        grass_roadTransitionS_dirt: null,
        grass_roadTransitionS: null,
        grass_roadTransitionW_dirt: null,
        grass_roadTransitionW: null,
        grass_transitionE: null,
        grass_transitionN: null,
        grass_transitionS: null,
        grass_transitionW: null,
        sand1: null,
        sand2: null,
        sand_roadCornerLL: null,
        sand_roadCornerLR: null,
        sand_roadCornerUL: null,
        sand_roadCornerUR: null,
        sand_roadCrossing: null,
        sand_roadCrossingRound: null,
        sand_roadEast: null,
        sand_roadNorth: null,
        sand_roadSplitE: null,
        sand_roadSplitN: null,
        sand_roadSplitS: null,
        sand_roadSplitW: null,
    },
    effects: {
        tracks: null,
        explosion: null
    }
};

// Animation states
let animatedPlayers = new Map(); // Stores players with active animations
let animatedBarrels = new Map();
let tracksArray = []; // Stores track marks that fade over time
let shootingEffects = []; // Stores active shooting effects

// Track loaded images
let imagesLoaded = 0;
const totalImages = 62;

function zoomIn() {
    if (zoomLevel >= MAX_ZOOM) return;

    // Store center position before zoom
    const centerX = width / 2 - originX;
    const centerY = height / 2 - originY;
    const centerRow = centerY / squareSide;
    const centerCol = centerX / squareSide;

    zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);

    // Update grid dimensions with new zoom level
    squareSide = Math.max(Math.min(width / dim, height / dim), 45) * zoomLevel;
    gridSide = squareSide * dim;

    // Adjust origin to keep the same center position
    originX = width / 2 - centerCol * squareSide;
    originY = height / 2 - centerRow * squareSide;

    boundOrigin();
    draw();
}

function zoomOut() {
    if (zoomLevel <= MIN_ZOOM) return;

    // Store center position before zoom
    const centerX = width / 2 - originX;
    const centerY = height / 2 - originY;
    const centerRow = centerY / squareSide;
    const centerCol = centerX / squareSide;

    zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);

    // Update grid dimensions with new zoom level
    squareSide = Math.max(Math.min(width / dim, height / dim), 45) * zoomLevel;
    gridSide = squareSide * dim;

    // Adjust origin to keep the same center position
    originX = width / 2 - centerCol * squareSide;
    originY = height / 2 - centerRow * squareSide;

    boundOrigin();
    draw();
}

function resetZoom() {
    // Store center position before zoom
    const centerX = width / 2 - originX;
    const centerY = height / 2 - originY;
    const centerRow = centerY / squareSide;
    const centerCol = centerX / squareSide;

    zoomLevel = 1;

    // Update grid dimensions with default zoom level
    squareSide = Math.max(Math.min(width / dim, height / dim), 45);
    gridSide = squareSide * dim;

    // Adjust origin to keep the same center position
    originX = width / 2 - centerCol * squareSide;
    originY = height / 2 - centerRow * squareSide;

    boundOrigin();
    draw();
}

function handleWheel(e) {
    e.preventDefault();

    if (e.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}

function addZoomListeners() {
    document.getElementById('zoom-in').addEventListener('click', zoomIn);
    document.getElementById('zoom-out').addEventListener('click', zoomOut);
    document.getElementById('zoom-reset').addEventListener('click', resetZoom);

    // Add wheel event for PC zoom
    ctx.canvas.addEventListener('wheel', handleWheel, { passive: false });
}

// Calculate distance between two points
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Get midpoint between two points
function getMidpoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    };
}

function handlePinchZoom(ev) {
    if (ev.touches.length !== 2) return;

    ev.preventDefault();

    // Get current touch positions
    const touch1 = {
        x: ev.touches[0].clientX - canvasX,
        y: ev.touches[0].clientY - canvasY
    };

    const touch2 = {
        x: ev.touches[1].clientX - canvasX,
        y: ev.touches[1].clientY - canvasY
    };

    // Calculate current distance between touches
    const currentDistance = getDistance(touch1, touch2);

    // Calculate center point of the pinch
    const currentCenter = getMidpoint(touch1, touch2);

    // If this is the start of a pinch gesture
    if (!pinchStartDistance) {
        pinchStartDistance = currentDistance;
        zoomStartLevel = zoomLevel;
        pinchTouches = [ev.touches[0].identifier, ev.touches[1].identifier];
        pinchCenterStart = currentCenter;
        return;
    }

    // Check if the active touches match our stored pinch touches
    const touchIds = [ev.touches[0].identifier, ev.touches[1].identifier];
    if (!pinchTouches.every(id => touchIds.includes(id))) {
        return;
    }

    // Calculate zoom scale factor
    const scaleFactor = currentDistance / pinchStartDistance;
    const newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomStartLevel * scaleFactor));

    // Store center position before zoom
    const centerX = pinchCenterStart.x;
    const centerY = pinchCenterStart.y;
    const centerRow = (centerY - originY) / squareSide;
    const centerCol = (centerX - originX) / squareSide;

    // Update zoom level
    zoomLevel = newZoomLevel;

    // Update grid dimensions with new zoom level
    squareSide = Math.max(Math.min(width / dim, height / dim), 45) * zoomLevel;
    gridSide = squareSide * dim;

    // Adjust origin to keep the pinch center position
    originX = pinchCenterStart.x - centerCol * squareSide;
    originY = pinchCenterStart.y - centerRow * squareSide;

    boundOrigin();
    draw();
}

function addCanvasListeners() {
    // Use throttled click handler to prevent performance issues with rapid clicks
    const throttledClickHandler = throttle((ev) => {
        handleClick(ev.clientX - canvasX, ev.clientY - canvasY);
    }, CLICK_THROTTLE_MS);
    
    ctx.canvas.addEventListener("click", throttledClickHandler);

    ctx.canvas.addEventListener("touchstart", ev => {
        // Handle pinch gesture (2 fingers)
        if (ev.touches.length === 2) {
            pinchStartDistance = null;
            handlePinchZoom(ev);
            return;
        }

        // Reset pinch variables if we're not in a pinch gesture
        pinchStartDistance = null;
        zoomStartLevel = null;
        pinchTouches = null;
        pinchCenterStart = null;

        // Handle pan gesture (1 finger)
        if (ev.touches.length !== 1) { return; }
        panningTouch = ev.touches[0].identifier;
        panStartCoords = { x: ev.touches[0].clientX - canvasX, y: ev.touches[0].clientY - canvasY };
        panOffset = { x: 0, y: 0 };
        originBeforePan = { x: originX, y: originY };
    });

    ctx.canvas.addEventListener("touchmove", ev => {
        ev.preventDefault();

        // Handle pinch/zoom with 2 fingers
        if (ev.touches.length === 2) {
            handlePinchZoom(ev);
            return;
        }

        // Handle pan with 1 finger
        for (const touch of ev.changedTouches) {
            if (touch.identifier != panningTouch) { continue }
            panOffset.x = touch.clientX - canvasX - panStartCoords.x;
            panOffset.y = touch.clientY - canvasY - panStartCoords.y;
            originX = originBeforePan.x + panOffset.x;
            originY = originBeforePan.y + panOffset.y;
            boundOrigin();
            draw();
        }
    });

    ctx.canvas.addEventListener("touchcancel", ev => {
        // Reset pinch variables
        pinchStartDistance = null;
        zoomStartLevel = null;
        pinchTouches = null;
        pinchCenterStart = null;

        // Handle pan cancellation
        for (const touch of ev.changedTouches) {
            if (touch.identifier != panningTouch) { continue }
            console.warn("touch canceled: ", ev);
            panningTouch = null;
            panStartCoords = null;
            panOffset = null;
            originX = originBeforePan.x;
            originY = originBeforePan.y;
            originBeforePan = null;
            boundOrigin();
            draw();
        }
    });

    ctx.canvas.addEventListener("touchend", ev => {
        // Reset pinch variables if any of the pinch touches ended
        if (pinchTouches && ev.changedTouches.length > 0) {
            for (const touch of ev.changedTouches) {
                if (pinchTouches.includes(touch.identifier)) {
                    pinchStartDistance = null;
                    zoomStartLevel = null;
                    pinchTouches = null;
                    pinchCenterStart = null;
                    break;
                }
            }
        }

        // Handle pan touch end
        for (const touch of ev.changedTouches) {
            if (touch.identifier != panningTouch) { continue }
            panningTouch = null;
            panStartCoords = null;
            panOffset = null;
            originBeforePan = null;
        }
    });
}

function parseMessage({ data }) {
    let msg = JSON.parse(data);
    if (msg.type == "gameState") {
        currState = JSON.parse(msg.state);
        for (const p in currState.players) {
            const oldPos = currState.players[p].pos;
            currState.players[p].pos = crd(oldPos);
        }
        currState.grid = Grid.deserialise(currState.grid);
        dim = currState.dim;
        console.log(currState);
        setup();
    } else if (msg.type == "updates") {
        msg.updates.forEach(u => {
            if (u.stat == "pos") {
                const oldPos = currState.players[u.player].pos;
                
                if (u.val == null) {
                    // Player died or was removed
                    currState.grid[oldPos] = null;
                    currState.players[u.player].pos = null;
                } else {
                    // Player moved - animate movement
                    const newCoord = crd(u.val);
                    
                    // Animate the movement if player exists and has a position
                    if (oldPos && newCoord) {
                        // Start movement animation for this player
                        startMoveAnimation(u.player, oldPos, newCoord);
                        
                        // Calculate angle for movement direction
                        const dx = newCoord.c - oldPos.c;
                        const dy = newCoord.r - oldPos.r;
                        const angle = Math.atan2(dy, dx);
                        
                        // Animate barrel rotation to point in direction of movement
                        startBarrelRotationAnimation(u.player, playerBarrelAngles[u.player] || 0, angle);
                        playerBarrelAngles[u.player] = angle;
                    }
                    
                    // Update positions in data structures
                    currState.grid[oldPos] = null;
                    currState.players[u.player].pos = newCoord;
                    currState.grid[newCoord] = u.player;
                }
                
                // Update distances if logged-in player moved
                if (loggedInUname != null && currState.players[loggedInUname].pos != null) {
                    distsFromPlayer = currState.grid.getDistsFromPos(currState.players[loggedInUname].pos);
                }
            } else if (u.stat == "hp") {
                // Handle HP changes - could be damage or healing
                const oldHp = currState.players[u.player].hp;
                const newHp = u.val;
                
                // If player took damage (HP decreased)
                if (newHp < oldHp && newHp > 0) {
                    // Trigger visual effect for damage
                    // This could be a shooting effect from the last attacker, but we don't
                    // know who attacked, so we'll just indicate damage on the tank itself
                    const playerPos = currState.players[u.player].pos;
                    if (playerPos) {
                        createShootingEffect(u.player, playerPos);
                    }
                }
                
                // Update the player's HP
                currState.players[u.player][u.stat] = u.val;
            } else {
                // Update other stats (AP, range, etc.)
                currState.players[u.player][u.stat] = u.val;
            }
        });
    } else if (msg.type == "winner") {
        location.href = "/list";
    } else if (msg.type == "error") {
        showErrorModal(msg.msg, null);
    }
    
    draw();
    updateSelectedMenu();
}

function attackModalSubmitted() {
    const amount = Number(getActiveModalBkg().querySelector("input.amount").value);

    // Create shooting effect for the attack
    createShootingEffect(loggedInUname, selectedSquare);

    ws.send(JSON.stringify({
        "type": "attack",
        "patient": currState.grid[selectedSquare],
        "amount": amount
    }));
    closeModal();
}

function giveModalSubmitted() {
    const amount = Number(getActiveModalBkg().querySelector("input.amount").value);
    ws.send(JSON.stringify({
        "type": "give",
        "patient": currState.grid[selectedSquare],
        "amount": amount
    }));
    closeModal();
}

function upgradeModalSubmitted() {
    const amount = Number(getActiveModalBkg().querySelector("input.amount").value);
    ws.send(JSON.stringify({
        "type": "upgrade",
        "amount": amount
    }));
    closeModal();
}

function attackButtonPressed(askAmount = false) {
    const maxAmount = currState.players[loggedInUname].ap;
    if (maxAmount < 0) { return; }

    // Create shooting effect from player to target
    createShootingEffect(loggedInUname, selectedSquare);

    if (!askAmount) {
        ws.send(JSON.stringify({
            "type": "attack",
            "patient": currState.grid[selectedSquare],
            "amount": 1
        }));
        return;
    }
    const modalBkg = document.querySelector("div.modalBkg#attackModalBkg");
    modalBkg.querySelector("input.amount").max = maxAmount;
    openModal(modalBkg);
}

function giveButtonPressed(askAmount = false) {
    const maxAmount = currState.players[loggedInUname].ap;
    if (maxAmount < 0) { return; }

    // Calculate angle from player to target for barrel rotation
    const playerPos = currState.players[loggedInUname].pos;
    const targetPos = selectedSquare;
    const dx = targetPos.c - playerPos.c;
    const dy = targetPos.r - playerPos.r;
    const angle = Math.atan2(dy, dx);

    // Update the player's barrel angle without shooting effect
    playerBarrelAngles[loggedInUname] = angle;

    // If target is a player, have them point back at us
    if (currState.grid[selectedSquare]) {
        const targetPlayer = currState.grid[selectedSquare];
        playerBarrelAngles[targetPlayer] = Math.atan2(-dy, -dx); // Reverse direction
    }

    if (!askAmount) {
        ws.send(JSON.stringify({
            "type": "give",
            "patient": currState.grid[selectedSquare],
            "amount": 1
        }));
        return;
    }
    const modalBkg = document.querySelector("div.modalBkg#giveModalBkg");
    modalBkg.querySelector("input.amount").max = maxAmount;
    openModal(modalBkg);
}

function moveButtonPressed() {
    // Store starting position before move
    const playerPos = currState.players[loggedInUname].pos;
    const startPos = new Coord(playerPos.r, playerPos.c);
    const endPos = selectedSquare;

    // Calculate angle for movement direction
    const dx = endPos.c - startPos.c;
    const dy = endPos.r - startPos.r;
    const angle = Math.atan2(dy, dx);

    // Update the player's barrel angle to point in direction of movement
    playerBarrelAngles[loggedInUname] = angle;

    // Create animation for the move
    startMoveAnimation(loggedInUname, startPos, endPos);

    // Send move command to server
    ws.send(JSON.stringify({
        type: "move",
        coord: selectedSquare.toString()
    }));
}

function voteButtonPressed() {
    let vote = currState.grid[selectedSquare];
    if (currState.players[loggedInUname].vote == vote) {
        vote = null;
    }
    ws.send(JSON.stringify({
        type: "vote",
        patient: vote
    }));
}

function upgradeButtonPressed(askAmount = false) {
    const maxAmount = Math.floor(currState.players[loggedInUname].ap / 2);
    if (maxAmount < 0) { return; }
    if (!askAmount) {
        ws.send(JSON.stringify({
            "type": "upgrade",
            "amount": 1
        }));
        return;
    }
    const modalBkg = document.querySelector("div.modalBkg#upgradeModalBkg");
    modalBkg.querySelector("input.amount").max = maxAmount;
    openModal(modalBkg);
}

function addSingleAndDblClickListener(element, clickListener, dblClickListener) {
    element.addEventListener("click", ev1 => {
        if (element.bigListenerDisabled) { return; }
        element.clickedAgain = false;
        let func = () => {
            element.clickedAgain = true;
            dblClickListener();
        };
        element.addEventListener("click", func, { once: true });
        element.bigListenerDisabled = true;
        setTimeout(() => {
            element.bigListenerDisabled = false;
            if (!element.clickedAgain) {
                clickListener();
            }
            element.removeEventListener("click", func)
        }, 250);
    });
}

function addSelectedMenuListeners() {
    ui.querySelector("button#moveButton").addEventListener("click", () => { moveButtonPressed(); });
    addSingleAndDblClickListener(ui.querySelector("button#attackButton"), () => attackButtonPressed(true), () => attackButtonPressed(false));
    addSingleAndDblClickListener(ui.querySelector("button#giveButton"), () => giveButtonPressed(true), () => giveButtonPressed(false));
    addSingleAndDblClickListener(ui.querySelector("button#upgradeButton"), () => upgradeButtonPressed(true), () => upgradeButtonPressed(false));
    ui.querySelector("button#voteButton").addEventListener("click", () => { voteButtonPressed(); });
}

function errorModalOKClicked() {
    if (typeof errorModalOKFunction == "function") {
        errorModalOKFunction();
    }
    closeModal();
}

function showErrorModal(errorText, okFunction) {
    const modalBkg = document.querySelector("div#errorModalBkg");
    modalBkg.querySelector("p.modalError").innerText = `${errorText}`;
    errorModalOKFunction = okFunction;
    openModal(modalBkg);
}
function loadGameImages() {
    return new Promise((resolve) => {
        const imagePaths = {
            tanks: {
                blue: './assets/tankBody_blue.png',
                green: './assets/tankBody_green.png',
                red: './assets/tankBody_red.png',
                dark: './assets/tankBody_dark.png',
                sand: './assets/tankBody_sand.png',
            },
            tanksOutline: {
                blue: './assets/tankBody_blue_outline.png',
                green: './assets/tankBody_green_outline.png',
                red: './assets/tankBody_red_outline.png',
                dark: './assets/tankBody_dark_outline.png',
                sand: './assets/tankBody_sand_outline.png',
            },
            barrels: {
                blue: './assets/tankBlue_barrel1.png',
                green: './assets/tankGreen_barrel1.png',
                red: './assets/tankRed_barrel1.png',
                dark: './assets/tankDark_barrel1.png',
                sand: './assets/tankSand_barrel1.png',
            },
            barrelsOutline: {
                blue: './assets/tankBlue_barrel1_outline.png',
                green: './assets/tankGreen_barrel1_outline.png',
                red: './assets/tankRed_barrel1_outline.png',
                dark: './assets/tankDark_barrel1_outline.png',
                sand: './assets/tankSand_barrel1_outline.png',
            },
            tiles: {
                grass1: './assets/tileGrass1.png',
                grass2: './assets/tileGrass2.png',
                grass_roadCornerLL: './assets/tileGrass_roadCornerLL.png',
                grass_roadCornerLR: './assets/tileGrass_roadCornerLR.png',
                grass_roadCornerUL: './assets/tileGrass_roadCornerUL.png',
                grass_roadCornerUR: './assets/tileGrass_roadCornerUR.png',
                grass_roadCrossing: './assets/tileGrass_roadCrossing.png',
                grass_roadCrossingRound: './assets/tileGrass_roadCrossingRound.png',
                grass_roadEast: './assets/tileGrass_roadEast.png',
                grass_roadNorth: './assets/tileGrass_roadNorth.png',
                grass_roadSplitE: './assets/tileGrass_roadSplitE.png',
                grass_roadSplitN: './assets/tileGrass_roadSplitN.png',
                grass_roadSplitS: './assets/tileGrass_roadSplitS.png',
                grass_roadSplitW: './assets/tileGrass_roadSplitW.png',
                grass_roadTransitionE_dirt: './assets/tileGrass_roadTransitionE_dirt.png',
                grass_roadTransitionE: './assets/tileGrass_roadTransitionE.png',
                grass_roadTransitionN_dirt: './assets/tileGrass_roadTransitionN_dirt.png',
                grass_roadTransitionN: './assets/tileGrass_roadTransitionN.png',
                grass_roadTransitionS_dirt: './assets/tileGrass_roadTransitionS_dirt.png',
                grass_roadTransitionS: './assets/tileGrass_roadTransitionS.png',
                grass_roadTransitionW_dirt: './assets/tileGrass_roadTransitionW_dirt.png',
                grass_roadTransitionW: './assets/tileGrass_roadTransitionW.png',
                grass_transitionE: './assets/tileGrass_transitionE.png',
                grass_transitionN: './assets/tileGrass_transitionN.png',
                grass_transitionS: './assets/tileGrass_transitionS.png',
                grass_transitionW: './assets/tileGrass_transitionW.png',
                sand1: './assets/tileSand1.png',
                sand2: './assets/tileSand2.png',
                sand_roadCornerLL: './assets/tileSand_roadCornerLL.png',
                sand_roadCornerLR: './assets/tileSand_roadCornerLR.png',
                sand_roadCornerUL: './assets/tileSand_roadCornerUL.png',
                sand_roadCornerUR: './assets/tileSand_roadCornerUR.png',
                sand_roadCrossing: './assets/tileSand_roadCrossing.png',
                sand_roadCrossingRound: './assets/tileSand_roadCrossingRound.png',
                sand_roadEast: './assets/tileSand_roadEast.png',
                sand_roadNorth: './assets/tileSand_roadNorth.png',
                sand_roadSplitE: './assets/tileSand_roadSplitE.png',
                sand_roadSplitN: './assets/tileSand_roadSplitN.png',
                sand_roadSplitS: './assets/tileSand_roadSplitS.png',
                sand_roadSplitW: './assets/tileSand_roadSplitW.png',
            },
            effects: {
                tracks: './assets/tracksSmall.png',
                explosion: './assets/explosion1.png',
            },
        };

        let imagesLoaded = 0;
        const totalImages = Object.values(imagePaths).reduce((total, category) => total + Object.keys(category).length, 0);

        function onImageLoad() {
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                resolve();
            }
        }

        // Load images dynamically
        for (const category in imagePaths) {
            IMAGES[category] = {};
            for (const key in imagePaths[category]) {
                const img = new Image();
                img.onload = onImageLoad;
                img.src = imagePaths[category][key];
                IMAGES[category][key] = img;
            }
        }
    });
}

export async function gamePageInit(_ctx, _width, _height) {
    ctx = _ctx;
    width = _width;
    height = _height;

    let loadingAnimationInterval = setInterval(() => {
        ctx.fillStyle = COLOURS.gridBackground;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = COLOURS.normalPlayerBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let d = new Date();
        let start = (d.getSeconds() + d.getMilliseconds() / 1000) * 5;
        ctx.arc(width / 2, height / 2, Math.min(width, height) / 5, start, start + 2, true);
        ctx.stroke();
    }, 250);

    // Load game assets
    await loadGameImages();

    ws = new WebSocket(`${location.protocol.replace("http", "ws")}//${location.host}/api/ws`);
    ws.addEventListener("open", () => {
        clearInterval(loadingAnimationInterval);

        addCanvasListeners();
        addSelectedMenuListeners();
        addZoomListeners();
        document.querySelector("div#errorModalBkg button#errorModalOKButton").addEventListener("click", errorModalOKClicked);

        ws.addEventListener("message", parseMessage);
        const inCaseOfEmergency = () => {
            showErrorModal("Connection error, reload page.", location.reload.bind(location));
        };
        ws.addEventListener("error", inCaseOfEmergency);
        ws.addEventListener("close", inCaseOfEmergency);
    });
}
