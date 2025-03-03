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
    let isCurrentPlayer = p.name === loggedInUname;
    
    if (gameState === "post-game" && currState.winner === p.name) {
        // Winner gets a gold tank
        tankIndex = "sand";
    } else if (isCurrentPlayer) {
        // Current player gets a green tank
        tankIndex = "green";
    } else {
        // Other players get different colored tanks based on name hash
        const hash = p.name.split("").reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        const options = ["blue", "red", "dark"];
        tankIndex = options[Math.abs(hash) % options.length];
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
    if (p.name in playerBarrelAngles) {
        barrelAngle = playerBarrelAngles[p.name] + Math.PI/2;
    } else {
        barrelAngle = -Math.PI/2; // Default pointing up
    }
    
    // Save context for barrel rotation
    ctx.save();
    
    // Translate to center of tank (pivot point for rotation)
    ctx.translate(tankX + tankWidth/2, tankY + tankHeight/2);
    
    // Rotate to point in proper direction
    ctx.rotate(barrelAngle);
    
    // Get barrel outline
    const barrelOutline = IMAGES.barrelsOutline[tankIndex];
    
    // Draw barrel (adjusting position to account for rotation around center)
    ctx.drawImage(
        tankBarrel, 
        -barrelWidth/2,
        -barrelHeight/2 - tankHeight/3, // Position barrel at top of tank
        barrelWidth, 
        barrelHeight
    );
    
    // Draw barrel outline
    ctx.drawImage(
        barrelOutline, 
        -barrelWidth/2,
        -barrelHeight/2 - tankHeight/3, // Position barrel at top of tank
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
        arr.splice(Math.floor(name.length/2), 0, '\n');
        name = arr.join('');
    }
    
    // Draw name with background for better visibility
    if (zoomLevel > 0.7){
        name = name.split('\n');
        for (let i = 0; i < name.length; i++) {
            const textY = y + 3 + 10*i;
        
            // Text background for better visibility
            const textWidth = ctx.measureText(name[i]).width;
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(x + squareSide/2 - textWidth/2 - 2, textY - 1, textWidth + 4, 12);
        
            // Text itself
            ctx.fillStyle = (gameState === "post-game" && currState.winner === p.name) ? 
                COLOURS.winnerName : COLOURS.normalName;
            ctx.fillText(name[i], x + squareSide/2, textY, squareSide);
        }
    
        // Draw stats (HP, AP, Range) with background
        const MARGIN = 3;
        const statsY = y + squareSide - MARGIN;
    
        ctx.textBaseline = "bottom";
    
        // Stats background
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(x + MARGIN, statsY - 10, squareSide - MARGIN*2, 12);
    
        // HP (left)
        ctx.fillStyle = COLOURS.hpStat;
        ctx.textAlign = "left";
        ctx.fillText(`${p.hp}`, x + MARGIN + 2, statsY, squareSide);
    
        // AP (center)
        ctx.fillStyle = COLOURS.apStat;
        ctx.textAlign = "center";
        ctx.fillText(`${p.ap}`, x + squareSide/2, statsY, squareSide);
    
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
    const x = originX + playerPos.c * squareSide + squareSide / 2;
    const y = originY + playerPos.r * squareSide + squareSide / 2;
    
    // Calculate angle from player to target
    const dx = targetPos.c - playerPos.c;
    const dy = targetPos.r - playerPos.r;
    const direction = Math.atan2(dy, dx);
    
    // Update the player's barrel angle
    playerBarrelAngles[playerName] = direction;
    
    shootingEffects.push({
        x: x,
        y: y,
        direction: direction,
        scale: 0, // Start small and grow
        createdAt: Date.now(),
        opacity: 1.0
    });
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

// Add animation for moving tanks
function startMoveAnimation(playerName, startPos, endPos) {
    // Animation duration in milliseconds
    const ANIMATION_DURATION = 800;
    
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
    
    // Create track marks for the movement
    createTrackMark(startPos, endPos);
    
    // Schedule animation updates
    animationLoop();
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
            // Update position using easeInOutQuad easing function
            const eased = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
            animation.currentX = animation.startX + (animation.endX - animation.startX) * eased;
            animation.currentY = animation.startY + (animation.endY - animation.startY) * eased;
        } else {
            // Animation complete
            playersToRemove.push(playerName);
        }
    }
    
    // Remove completed animations
    for (const player of playersToRemove) {
        animatedPlayers.delete(player);
    }
    
    // Continue animation loop if there are active animations
    if (animatedPlayers.size > 0) {
        requestAnimationFrame(animationLoop);
    }
}

// Animation loop
function animationLoop() {
    updateAnimations();
    draw();
}

function draw() {
    // Fill background
    ctx.fillStyle = COLOURS.gridBackground;
    ctx.fillRect(0, 0, width, height);
    
    // Draw grass tiles for the grid
    for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim; c++) {
            const x = originX + c * squareSide;
            const y = originY + r * squareSide;
            
            // Alternate between grass1 and grass2 in a checkerboard pattern
            const tileImage = ((r + c) % 2 === 0) ? IMAGES.tiles.grass1 : IMAGES.tiles.grass2;
            ctx.drawImage(tileImage, x, y, squareSide, squareSide);
        }
    }
    
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

function handleClick(cx, cy) {
    const x = cx - originX, y = cy - originY;
    let pos = new Coord(Math.floor(y / squareSide), Math.floor(x / squareSide));

    // If this is a new selection (not deselecting)
    if (selectedSquare == null || !selectedSquare.equals(pos)) {
        // If logged in player exists and is alive
        if (loggedInUname && currState.players[loggedInUname].hp > 0) {
            const playerPos = currState.players[loggedInUname].pos;
            
            // Calculate angle from player to selected tile
            const dx = pos.c - playerPos.c;
            const dy = pos.r - playerPos.r;
            const angle = Math.atan2(dy, dx);
            
            // Store the angle for the player's barrel
            playerBarrelAngles[loggedInUname] = angle;
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
                
                // Store the angle for the selected player's barrel
                playerBarrelAngles[selectedPlayerName] = angle;
            }
        }
    }

    if (selectedSquare != null && selectedSquare.equals(pos)) {
        selectedSquare = null;
    } else {
        selectedSquare = pos;
    }
    updateSelectedMenu();

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
        grass2: null
    },
    effects: {
        tracks: null,
        explosion: null
    }
};

// Animation states
let animatedPlayers = new Map(); // Stores players with active animations
let tracksArray = []; // Stores track marks that fade over time
let shootingEffects = []; // Stores active shooting effects

// Track loaded images
let imagesLoaded = 0;
const totalImages = 24;

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
    ctx.canvas.addEventListener("click", ev => {
        handleClick(ev.clientX - canvasX, ev.clientY - canvasY);
    });
    
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
                currState.grid[currState.players[u.player].pos] = null;
                if (u.val == null) {
                    currState.players[u.player].pos = null;
                } else {
                    const newCoord = crd(u.val);
                    currState.players[u.player].pos = newCoord;
                    currState.grid[newCoord] = u.player;
                }
                if (loggedInUname != null && currState.players[loggedInUname].pos != null) {
                    distsFromPlayer = currState.grid.getDistsFromPos(currState.players[loggedInUname].pos);
                }
            } else {
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

// Function to load all game images
function loadGameImages() {
    return new Promise((resolve) => {
        function onImageLoad() {
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                resolve();
            }
        }
        
        // Load tank body images
        IMAGES.tanks.blue = new Image();
        IMAGES.tanks.blue.onload = onImageLoad;
        IMAGES.tanks.blue.src = './assets/tankBody_blue.png';
        
        IMAGES.tanks.green = new Image();
        IMAGES.tanks.green.onload = onImageLoad;
        IMAGES.tanks.green.src = './assets/tankBody_green.png';
        
        IMAGES.tanks.red = new Image();
        IMAGES.tanks.red.onload = onImageLoad;
        IMAGES.tanks.red.src = './assets/tankBody_red.png';
        
        IMAGES.tanks.dark = new Image();
        IMAGES.tanks.dark.onload = onImageLoad;
        IMAGES.tanks.dark.src = './assets/tankBody_dark.png';
        
        IMAGES.tanks.sand = new Image();
        IMAGES.tanks.sand.onload = onImageLoad;
        IMAGES.tanks.sand.src = './assets/tankBody_sand.png';
        
        // Load tank outline images
        IMAGES.tanksOutline.blue = new Image();
        IMAGES.tanksOutline.blue.onload = onImageLoad;
        IMAGES.tanksOutline.blue.src = './assets/tankBody_blue_outline.png';
        
        IMAGES.tanksOutline.green = new Image();
        IMAGES.tanksOutline.green.onload = onImageLoad;
        IMAGES.tanksOutline.green.src = './assets/tankBody_green_outline.png';
        
        IMAGES.tanksOutline.red = new Image();
        IMAGES.tanksOutline.red.onload = onImageLoad;
        IMAGES.tanksOutline.red.src = './assets/tankBody_red_outline.png';
        
        IMAGES.tanksOutline.dark = new Image();
        IMAGES.tanksOutline.dark.onload = onImageLoad;
        IMAGES.tanksOutline.dark.src = './assets/tankBody_dark_outline.png';
        
        IMAGES.tanksOutline.sand = new Image();
        IMAGES.tanksOutline.sand.onload = onImageLoad;
        IMAGES.tanksOutline.sand.src = './assets/tankBody_sand_outline.png';
        
        // Load barrel images
        IMAGES.barrels.blue = new Image();
        IMAGES.barrels.blue.onload = onImageLoad;
        IMAGES.barrels.blue.src = './assets/tankBlue_barrel1.png';
        
        IMAGES.barrels.green = new Image();
        IMAGES.barrels.green.onload = onImageLoad;
        IMAGES.barrels.green.src = './assets/tankGreen_barrel1.png';
        
        IMAGES.barrels.red = new Image();
        IMAGES.barrels.red.onload = onImageLoad;
        IMAGES.barrels.red.src = './assets/tankRed_barrel1.png';
        
        IMAGES.barrels.dark = new Image();
        IMAGES.barrels.dark.onload = onImageLoad;
        IMAGES.barrels.dark.src = './assets/tankDark_barrel1.png';
        
        IMAGES.barrels.sand = new Image();
        IMAGES.barrels.sand.onload = onImageLoad;
        IMAGES.barrels.sand.src = './assets/tankSand_barrel1.png';
        
        // Load barrel outline images
        IMAGES.barrelsOutline.blue = new Image();
        IMAGES.barrelsOutline.blue.onload = onImageLoad;
        IMAGES.barrelsOutline.blue.src = './assets/tankBlue_barrel1_outline.png';
        
        IMAGES.barrelsOutline.green = new Image();
        IMAGES.barrelsOutline.green.onload = onImageLoad;
        IMAGES.barrelsOutline.green.src = './assets/tankGreen_barrel1_outline.png';
        
        IMAGES.barrelsOutline.red = new Image();
        IMAGES.barrelsOutline.red.onload = onImageLoad;
        IMAGES.barrelsOutline.red.src = './assets/tankRed_barrel1_outline.png';
        
        IMAGES.barrelsOutline.dark = new Image();
        IMAGES.barrelsOutline.dark.onload = onImageLoad;
        IMAGES.barrelsOutline.dark.src = './assets/tankDark_barrel1_outline.png';
        
        IMAGES.barrelsOutline.sand = new Image();
        IMAGES.barrelsOutline.sand.onload = onImageLoad;
        IMAGES.barrelsOutline.sand.src = './assets/tankSand_barrel1_outline.png';
        
        // Load grass tile images
        IMAGES.tiles.grass1 = new Image();
        IMAGES.tiles.grass1.onload = onImageLoad;
        IMAGES.tiles.grass1.src = './assets/tileGrass1.png';
        
        IMAGES.tiles.grass2 = new Image();
        IMAGES.tiles.grass2.onload = onImageLoad;
        IMAGES.tiles.grass2.src = './assets/tileGrass2.png';
        
        // Load effect images
        IMAGES.effects.tracks = new Image();
        IMAGES.effects.tracks.onload = onImageLoad;
        IMAGES.effects.tracks.src = './assets/tracksSmall.png';
        
        IMAGES.effects.explosion = new Image();
        IMAGES.effects.explosion.onload = onImageLoad;
        IMAGES.effects.explosion.src = './assets/explosion1.png';
    });
}

/**
 * 
 * @param {CanvasRenderingContext2D} _ctx
*/
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
