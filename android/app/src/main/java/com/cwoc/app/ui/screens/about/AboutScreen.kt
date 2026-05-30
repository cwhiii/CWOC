package com.cwoc.app.ui.screens.about

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.BuildConfig
import com.cwoc.app.R
import com.cwoc.app.ui.components.CwocPagePanel
import com.cwoc.app.ui.components.TopBarProfileAvatar

private val CoffeeBrown = Color(0xFF8B5A2B)
private val CoffeeBrownDark = Color(0xFF6B4226)
private val ParchmentLight = Color(0xFFFFF8E1)
private val GoldAccent = Color(0xFFD4AF37)
private val TextDark = Color(0xFF1A1208)
private val TextBrown = Color(0xFF4A2C2A)

/**
 * About & Buy Me a Coffee screen.
 * Shows app info, creator details, philosophy, tech stack, and a support link.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AboutScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("About") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = { TopBarProfileAvatar() },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        CwocPagePanel(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // ─── Hero ────────────────────────────────────────────────────
                Image(
                    painter = painterResource(id = R.drawable.cwoc_logo),
                    contentDescription = "CWOC Logo",
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .border(3.dp, CoffeeBrown, CircleShape),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "C.W.'s Omni Chits",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextBrown
                )
                Text(
                    text = "One chit to rule them all.",
                    fontSize = 16.sp,
                    fontStyle = FontStyle.Italic,
                    color = CoffeeBrown
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "v${BuildConfig.VERSION_NAME}",
                    fontSize = 13.sp,
                    color = Color(0xFF8B7355)
                )

                Spacer(modifier = Modifier.height(24.dp))

                // ─── What is CWOC ────────────────────────────────────────────
                AboutCard(title = "📜 What is CWOC?") {
                    Text(
                        text = "A self-hosted task, note, and calendar management app built around one flexible record — the chit. A chit can be a task, note, calendar event, alarm, checklist, or project, all in one unified data model.",
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        color = TextDark
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "No subscriptions. No cloud dependency. Your data lives on your hardware in a single SQLite file, accessible from any device on your network.",
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        color = TextDark
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ─── Buy Me a Coffee ─────────────────────────────────────────
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = ParchmentLight),
                    border = androidx.compose.foundation.BorderStroke(2.dp, GoldAccent),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "☕ Buy Me a Coffee",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextBrown
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "CWOC is a labor of love — built solo, maintained solo, and given away freely. If it's made your life a little more organized, consider fueling the next feature with a coffee.",
                            fontSize = 14.sp,
                            lineHeight = 22.sp,
                            color = TextDark,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://buymeacoffee.com/cwholemaniii"))
                                context.startActivity(intent)
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CoffeeBrown,
                                contentColor = ParchmentLight
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "☕  Buy Me a Coffee",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ─── Creator ─────────────────────────────────────────────────
                AboutCard(title = "👤 The Creator") {
                    Text(
                        text = "C.W. Holeman III",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextBrown
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Software developer, tinkerer, and believer in tools that work the way you think — not the other way around. CWOC started as a personal itch-scratcher and grew into a full-featured system that replaces a patchwork of apps with one unified interface.",
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        color = TextDark
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.cwholemaniii.com/pages/home.shtml"))
                                context.startActivity(intent)
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CoffeeBrown,
                                contentColor = ParchmentLight
                            ),
                            shape = RoundedCornerShape(5.dp)
                        ) { Text("🌐 Website", fontSize = 13.sp) }

                        Button(
                            onClick = {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://buymeacoffee.com/cwholemaniii"))
                                context.startActivity(intent)
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CoffeeBrown,
                                contentColor = ParchmentLight
                            ),
                            shape = RoundedCornerShape(5.dp)
                        ) { Text("☕ Support", fontSize = 13.sp) }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ─── Philosophy ──────────────────────────────────────────────
                AboutCard(title = "💡 Philosophy") {
                    val points = listOf(
                        "One record, infinite uses." to "A chit adapts to what you need — no rigid categories, no separate apps for separate things.",
                        "Your data, your hardware." to "Self-hosted, single SQLite file, no cloud lock-in. You own everything.",
                        "No build step, no framework." to "Vanilla JS, HTML, CSS. Lightweight enough to run on a Raspberry Pi.",
                        "Connections surface naturally." to "When everything lives on the same record, every field makes every view smarter."
                    )
                    points.forEach { (title, desc) ->
                        Text(
                            text = "• $title",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextDark
                        )
                        Text(
                            text = "  $desc",
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            color = TextDark,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ─── Tech Stack ──────────────────────────────────────────────
                AboutCard(title = "🔧 Tech Stack") {
                    val techs = listOf(
                        "🐍 Python 3 + FastAPI",
                        "🗄️ SQLite3",
                        "📜 Vanilla JavaScript",
                        "🌐 HTML5 + CSS3",
                        "🤖 Kotlin + Compose",
                        "⚡ Uvicorn"
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        techs.forEach { tech ->
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = Color(0xFFF5E6CC)
                                ),
                                shape = RoundedCornerShape(5.dp)
                            ) {
                                Text(
                                    text = tech,
                                    fontSize = 13.sp,
                                    color = TextDark,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ─── License ─────────────────────────────────────────────────
                AboutCard(title = "📄 License") {
                    Text(
                        text = "CWOC is a personal project. All rights reserved. Built with care, shared with friends.",
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        color = TextDark
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun AboutCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = ParchmentLight),
        border = androidx.compose.foundation.BorderStroke(1.dp, CoffeeBrown),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextBrown,
                modifier = Modifier.padding(bottom = 10.dp)
            )
            content()
        }
    }
}
